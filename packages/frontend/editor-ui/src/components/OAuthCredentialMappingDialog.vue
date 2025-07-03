<template>
	<n8n-modal
		:value="visible"
		:title="i18n.baseText('oauthCredentialMapping.title')"
		:subtitle="i18n.baseText('oauthCredentialMapping.subtitle')"
		@update:value="$emit('update:visible', $event)"
		width="600px"
	>
		<template #content>
			<div class="oauth-mapping-dialog">
				<!-- Step 1: Select Template Credential -->
				<div v-if="currentStep === 'select'" class="step-content">
					<h3>{{ i18n.baseText('oauthCredentialMapping.selectTemplate') }}</h3>
					<p>{{ i18n.baseText('oauthCredentialMapping.selectTemplateDescription') }}</p>

					<div class="form-field">
						<n8n-input-label :label="i18n.baseText('oauthCredentialMapping.customUserId.label')">
							<n8n-input
								v-model="formData.customUserId"
								:placeholder="i18n.baseText('oauthCredentialMapping.customUserId.placeholder')"
								data-test-id="oauth-mapping-custom-user-id"
							/>
						</n8n-input-label>
					</div>

					<div class="form-field">
						<n8n-input-label
							:label="i18n.baseText('oauthCredentialMapping.templateCredential.label')"
						>
							<n8n-select
								v-model="formData.templateCredentialId"
								:placeholder="
									i18n.baseText('oauthCredentialMapping.templateCredential.placeholder')
								"
								data-test-id="oauth-mapping-template-credential"
							>
								<n8n-option
									v-for="credential in oauthTemplateCredentials"
									:key="credential.id"
									:value="credential.id"
									:label="`${credential.name} (${credential.type})`"
								/>
							</n8n-select>
						</n8n-input-label>
					</div>

					<div class="form-field">
						<n8n-input-label :label="i18n.baseText('oauthCredentialMapping.description.label')">
							<n8n-input
								v-model="formData.description"
								:placeholder="i18n.baseText('oauthCredentialMapping.description.placeholder')"
								type="textarea"
								data-test-id="oauth-mapping-description"
							/>
						</n8n-input-label>
					</div>

					<div class="oauth-type-info" v-if="selectedCredentialType">
						<n8n-notice type="info">
							{{
								i18n.baseText('oauthCredentialMapping.oauthTypeInfo', {
									interpolate: {
										type: getOAuthType(selectedCredentialType),
										credentialType: selectedCredentialType,
									},
								})
							}}
						</n8n-notice>
					</div>
				</div>

				<!-- Step 2: OAuth Authorization -->
				<div v-if="currentStep === 'authorize'" class="step-content">
					<h3>{{ i18n.baseText('oauthCredentialMapping.authorize') }}</h3>
					<p>{{ i18n.baseText('oauthCredentialMapping.authorizeDescription') }}</p>

					<div class="authorization-info">
						<div class="info-row">
							<strong>{{ i18n.baseText('oauthCredentialMapping.customUserId.label') }}:</strong>
							{{ formData.customUserId }}
						</div>
						<div class="info-row">
							<strong>{{ i18n.baseText('oauthCredentialMapping.credentialType') }}:</strong>
							{{ selectedCredentialType }}
						</div>
						<div class="info-row">
							<strong>{{ i18n.baseText('oauthCredentialMapping.oauthType') }}:</strong>
							{{ getOAuthType(selectedCredentialType) }}
						</div>
					</div>

					<n8n-notice type="warning" class="authorization-warning">
						{{ i18n.baseText('oauthCredentialMapping.authorizationWarning') }}
					</n8n-notice>

					<div class="authorization-actions">
						<n8n-button
							@click="initiateOAuthFlow"
							:loading="isInitiating"
							size="large"
							type="primary"
						>
							{{ i18n.baseText('oauthCredentialMapping.startAuthorization') }}
						</n8n-button>
					</div>
				</div>

				<!-- Step 3: Success -->
				<div v-if="currentStep === 'success'" class="step-content">
					<div class="success-content">
						<n8n-icon icon="check-circle" size="large" color="success" />
						<h3>{{ i18n.baseText('oauthCredentialMapping.success') }}</h3>
						<p>{{ i18n.baseText('oauthCredentialMapping.successDescription') }}</p>

						<div class="mapping-details">
							<div class="detail-row">
								<strong>{{ i18n.baseText('oauthCredentialMapping.customUserId.label') }}:</strong>
								{{ formData.customUserId }}
							</div>
							<div class="detail-row">
								<strong
									>{{ i18n.baseText('oauthCredentialMapping.templateCredential.label') }}:</strong
								>
								{{ getCredentialName(formData.templateCredentialId) }}
							</div>
							<div class="detail-row" v-if="createdMapping">
								<strong>{{ i18n.baseText('oauthCredentialMapping.actualCredential') }}:</strong>
								{{ getCredentialName(createdMapping.actualCredentialId) }}
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>

		<template #footer>
			<div class="dialog-footer">
				<n8n-button
					v-if="currentStep !== 'success'"
					@click="$emit('update:visible', false)"
					type="tertiary"
				>
					{{ i18n.baseText('oauthCredentialMapping.cancel') }}
				</n8n-button>

				<n8n-button
					v-if="currentStep === 'select'"
					@click="proceedToAuthorization"
					:disabled="!canProceed"
					type="primary"
				>
					{{ i18n.baseText('oauthCredentialMapping.next') }}
				</n8n-button>

				<n8n-button
					v-if="currentStep === 'success'"
					@click="$emit('update:visible', false)"
					type="primary"
				>
					{{ i18n.baseText('oauthCredentialMapping.done') }}
				</n8n-button>
			</div>
		</template>
	</n8n-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from '@n8n/i18n';
import { useToast } from '@/composables/useToast';
import { useCredentialsStore } from '@/stores/credentials.store';
import { makeRestApiRequest } from '@n8n/rest-api-client';
import { useRootStore } from '@n8n/stores/useRootStore';

interface Props {
	visible: boolean;
}

interface Credential {
	id: string;
	name: string;
	type: string;
	useUserFilter?: boolean;
}

interface CreatedMapping {
	id: string;
	customUserId: string;
	templateCredentialId: string;
	actualCredentialId: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
	'update:visible': [value: boolean];
	'mapping-created': [mapping: CreatedMapping];
}>();

const i18n = useI18n();
const toast = useToast();
const credentialsStore = useCredentialsStore();
const rootStore = useRootStore();

// Reactive data
const currentStep = ref<'select' | 'authorize' | 'success'>('select');
const isInitiating = ref(false);
const oauthTemplateCredentials = ref<Credential[]>([]);
const supportedOAuthTypes = ref<{ oauth1: string[]; oauth2: string[] }>({ oauth1: [], oauth2: [] });
const createdMapping = ref<CreatedMapping | null>(null);

const formData = ref({
	customUserId: '',
	templateCredentialId: '',
	description: '',
});

// Computed properties
const canProceed = computed(() => {
	return formData.value.customUserId && formData.value.templateCredentialId;
});

const selectedCredentialType = computed(() => {
	const credential = oauthTemplateCredentials.value.find(
		(c) => c.id === formData.value.templateCredentialId,
	);
	return credential?.type || '';
});

// Methods
function getOAuthType(credentialType: string): string {
	const type = credentialType.toLowerCase();

	if (supportedOAuthTypes.value.oauth1.some((t) => t.toLowerCase() === type)) {
		return 'OAuth 1.0';
	} else if (supportedOAuthTypes.value.oauth2.some((t) => t.toLowerCase() === type)) {
		return 'OAuth 2.0';
	}

	return 'Unknown';
}

function getCredentialName(credentialId: string): string {
	const credential = oauthTemplateCredentials.value.find((c) => c.id === credentialId);
	return credential ? `${credential.name} (${credential.type})` : credentialId;
}

async function loadOAuthCredentials() {
	try {
		// Load all credentials and filter for OAuth templates
		const credentials = await credentialsStore.getAllCredentials();

		// Load supported OAuth types
		const typesResponse = await makeRestApiRequest(
			rootStore.restApiContext,
			'GET',
			'/user-credential-mappings/oauth/supported-types',
		);
		supportedOAuthTypes.value = typesResponse;

		// Filter credentials that are OAuth templates
		const allSupportedTypes = [...typesResponse.oauth1, ...typesResponse.oauth2];
		oauthTemplateCredentials.value = credentials.filter(
			(cred) => cred.useUserFilter && allSupportedTypes.includes(cred.type),
		);
	} catch (error) {
		toast.showError(error, 'Failed to load OAuth credentials');
	}
}

function proceedToAuthorization() {
	if (!canProceed.value) return;
	currentStep.value = 'authorize';
}

async function initiateOAuthFlow() {
	if (!canProceed.value) return;

	isInitiating.value = true;
	try {
		const response = await makeRestApiRequest(
			rootStore.restApiContext,
			'POST',
			'/credentials/multi-user/oauth/url',
			{
				credentialId: formData.value.templateCredentialId,
				customUserId: formData.value.customUserId,
			},
		);

		// Open OAuth authorization URL in new window
		const authWindow = window.open(
			response.authUrl,
			'oauth-authorization',
			'width=600,height=700,scrollbars=yes,resizable=yes',
		);

		// Poll for window closure (indicating completion)
		const pollTimer = setInterval(() => {
			if (authWindow?.closed) {
				clearInterval(pollTimer);
				// Check if mapping was created successfully
				checkMappingCreation();
			}
		}, 1000);

		// Timeout after 10 minutes
		setTimeout(() => {
			clearInterval(pollTimer);
			if (authWindow && !authWindow.closed) {
				authWindow.close();
				toast.showError(null, 'OAuth authorization timed out');
			}
		}, 600000);
	} catch (error) {
		toast.showError(error, 'Failed to initiate OAuth flow');
	} finally {
		isInitiating.value = false;
	}
}

async function checkMappingCreation() {
	try {
		// Check if mapping was created by looking for it
		const mappings = await makeRestApiRequest(
			rootStore.restApiContext,
			'GET',
			`/user-credential-mappings/user/${formData.value.customUserId}`,
		);

		const newMapping = mappings.find(
			(m: any) => m.templateCredentialId === formData.value.templateCredentialId,
		);

		if (newMapping) {
			createdMapping.value = newMapping;
			currentStep.value = 'success';
			emit('mapping-created', newMapping);
			toast.showMessage({
				title: 'OAuth credential mapping created successfully',
				type: 'success',
			});
		} else {
			toast.showError(null, 'OAuth authorization may have failed. Please try again.');
		}
	} catch (error) {
		toast.showError(error, 'Failed to verify mapping creation');
	}
}

// Reset form when dialog is closed
watch(
	() => props.visible,
	(visible) => {
		if (!visible) {
			currentStep.value = 'select';
			formData.value = {
				customUserId: '',
				templateCredentialId: '',
				description: '',
			};
			createdMapping.value = null;
		}
	},
);

// Lifecycle
onMounted(async () => {
	await loadOAuthCredentials();
});
</script>

<style scoped>
.oauth-mapping-dialog {
	padding: 20px 0;
}

.step-content {
	min-height: 300px;
}

.form-field {
	margin-bottom: 20px;
}

.oauth-type-info {
	margin-top: 16px;
}

.authorization-info {
	background: var(--color-background-light);
	padding: 16px;
	border-radius: 8px;
	margin: 16px 0;
}

.info-row,
.detail-row {
	margin-bottom: 8px;
}

.authorization-warning {
	margin: 16px 0;
}

.authorization-actions {
	text-align: center;
	margin-top: 24px;
}

.success-content {
	text-align: center;
}

.success-content h3 {
	margin: 16px 0;
	color: var(--color-success);
}

.mapping-details {
	background: var(--color-background-light);
	padding: 16px;
	border-radius: 8px;
	margin-top: 20px;
	text-align: left;
}

.dialog-footer {
	display: flex;
	justify-content: space-between;
	gap: 12px;
}
</style>
