<template>
	<div class="credential-mapping-manager">
		<div class="header">
			<h2>{{ i18n.baseText('credentialMapping.title') }}</h2>
			<p>{{ i18n.baseText('credentialMapping.description') }}</p>
		</div>

		<!-- Create New Mapping -->
		<div class="create-mapping-section">
			<h3>{{ i18n.baseText('credentialMapping.createNew') }}</h3>

			<!-- Mapping Type Selection -->
			<div class="mapping-type-selection">
				<n8n-radio-buttons
					v-model="mappingType"
					:options="mappingTypeOptions"
					@update:model-value="onMappingTypeChange"
				/>
			</div>

			<!-- Manual Mapping Form -->
			<div v-if="mappingType === 'manual'" class="manual-mapping-form">
				<div class="form-row">
					<n8n-input
						v-model="newMapping.customUserId"
						:placeholder="i18n.baseText('credentialMapping.customUserId.placeholder')"
						:label="i18n.baseText('credentialMapping.customUserId.label')"
					/>
					<n8n-select
						v-model="newMapping.templateCredentialId"
						:placeholder="i18n.baseText('credentialMapping.templateCredential.placeholder')"
						:label="i18n.baseText('credentialMapping.templateCredential.label')"
					>
						<n8n-option
							v-for="credential in templateCredentials"
							:key="credential.id"
							:value="credential.id"
							:label="`${credential.name} (${credential.type})`"
						/>
					</n8n-select>
					<n8n-select
						v-model="newMapping.actualCredentialId"
						:placeholder="i18n.baseText('credentialMapping.actualCredential.placeholder')"
						:label="i18n.baseText('credentialMapping.actualCredential.label')"
					>
						<n8n-option
							v-for="credential in actualCredentials"
							:key="credential.id"
							:value="credential.id"
							:label="`${credential.name} (${credential.type})`"
						/>
					</n8n-select>
				</div>
				<div class="form-row">
					<n8n-input
						v-model="newMapping.description"
						:placeholder="i18n.baseText('credentialMapping.description.placeholder')"
						:label="i18n.baseText('credentialMapping.description.label')"
						type="textarea"
					/>
				</div>
				<div class="form-actions">
					<n8n-button @click="createMapping" :disabled="!canCreateMapping" :loading="isCreating">
						{{ i18n.baseText('credentialMapping.create') }}
					</n8n-button>
				</div>
			</div>

			<!-- OAuth Mapping Button -->
			<div v-if="mappingType === 'oauth'" class="oauth-mapping-form">
				<p>{{ i18n.baseText('credentialMapping.oauthDescription') }}</p>
				<div class="form-actions">
					<n8n-button @click="showOAuthDialog = true" type="primary">
						{{ i18n.baseText('credentialMapping.createOAuthMapping') }}
					</n8n-button>
				</div>
			</div>
		</div>

		<!-- Existing Mappings -->
		<div class="mappings-list-section">
			<h3>{{ i18n.baseText('credentialMapping.existingMappings') }}</h3>

			<!-- Filter by template credential -->
			<div class="filter-section">
				<n8n-select
					v-model="selectedTemplateFilter"
					:placeholder="i18n.baseText('credentialMapping.filterByTemplate')"
					@update:model-value="loadMappings"
				>
					<n8n-option value="" :label="i18n.baseText('credentialMapping.allTemplates')" />
					<n8n-option
						v-for="credential in templateCredentials"
						:key="credential.id"
						:value="credential.id"
						:label="`${credential.name} (${credential.type})`"
					/>
				</n8n-select>
			</div>

			<!-- Mappings table -->
			<div v-if="mappings.length > 0" class="mappings-table">
				<table>
					<thead>
						<tr>
							<th>{{ i18n.baseText('credentialMapping.table.customUserId') }}</th>
							<th>{{ i18n.baseText('credentialMapping.table.templateCredential') }}</th>
							<th>{{ i18n.baseText('credentialMapping.table.actualCredential') }}</th>
							<th>{{ i18n.baseText('credentialMapping.table.description') }}</th>
							<th>{{ i18n.baseText('credentialMapping.table.status') }}</th>
							<th>{{ i18n.baseText('credentialMapping.table.actions') }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="mapping in mappings" :key="mapping.id">
							<td>{{ mapping.customUserId }}</td>
							<td>{{ getCredentialName(mapping.templateCredentialId) }}</td>
							<td>{{ getCredentialName(mapping.actualCredentialId) }}</td>
							<td>{{ mapping.description || '-' }}</td>
							<td>
								<n8n-badge
									:theme="mapping.isActive ? 'success' : 'secondary'"
									:text="mapping.isActive ? 'Active' : 'Inactive'"
								/>
							</td>
							<td>
								<n8n-button
									size="small"
									type="tertiary"
									@click="toggleMappingStatus(mapping)"
									:loading="mapping.isUpdating"
								>
									{{ mapping.isActive ? 'Deactivate' : 'Activate' }}
								</n8n-button>
								<n8n-button
									size="small"
									type="tertiary"
									@click="deleteMapping(mapping)"
									:loading="mapping.isDeleting"
								>
									{{ i18n.baseText('credentialMapping.delete') }}
								</n8n-button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<div v-else class="no-mappings">
				<p>{{ i18n.baseText('credentialMapping.noMappings') }}</p>
			</div>
		</div>

		<!-- OAuth Credential Mapping Dialog -->
		<OAuthCredentialMappingDialog
			:visible="showOAuthDialog"
			@update:visible="showOAuthDialog = $event"
			@mapping-created="onOAuthMappingCreated"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '@n8n/i18n';
import { useToast } from '@/composables/useToast';
import { useCredentialsStore } from '@/stores/credentials.store';
import { makeRestApiRequest } from '@n8n/rest-api-client';
import { useRootStore } from '@n8n/stores/useRootStore';
import OAuthCredentialMappingDialog from './OAuthCredentialMappingDialog.vue';

interface CredentialMapping {
	id: string;
	customUserId: string;
	templateCredentialId: string;
	actualCredentialId: string;
	description?: string;
	isActive: boolean;
	isUpdating?: boolean;
	isDeleting?: boolean;
}

interface Credential {
	id: string;
	name: string;
	type: string;
	useUserFilter?: boolean;
}

const i18n = useI18n();
const toast = useToast();
const credentialsStore = useCredentialsStore();
const rootStore = useRootStore();

// Reactive data
const mappings = ref<CredentialMapping[]>([]);
const templateCredentials = ref<Credential[]>([]);
const actualCredentials = ref<Credential[]>([]);
const selectedTemplateFilter = ref('');
const isCreating = ref(false);
const mappingType = ref<'manual' | 'oauth'>('manual');
const showOAuthDialog = ref(false);

const newMapping = ref({
	customUserId: '',
	templateCredentialId: '',
	actualCredentialId: '',
	description: '',
});

// Computed properties
const canCreateMapping = computed(() => {
	return (
		newMapping.value.customUserId &&
		newMapping.value.templateCredentialId &&
		newMapping.value.actualCredentialId
	);
});

const mappingTypeOptions = computed(() => [
	{
		label: i18n.baseText('credentialMapping.manual'),
		value: 'manual',
	},
	{
		label: i18n.baseText('credentialMapping.oauth'),
		value: 'oauth',
	},
]);

// Methods
async function loadCredentials() {
	try {
		const credentials = await credentialsStore.getAllCredentials();

		// Separate template credentials (useUserFilter: true) from actual credentials
		templateCredentials.value = credentials.filter((cred) => cred.useUserFilter);
		actualCredentials.value = credentials.filter((cred) => !cred.useUserFilter);
	} catch (error) {
		toast.showError(error, 'Failed to load credentials');
	}
}

async function loadMappings() {
	try {
		let url = '/user-credential-mappings';
		if (selectedTemplateFilter.value) {
			url += `/template/${selectedTemplateFilter.value}`;
		}

		const response = await makeRestApiRequest(rootStore.restApiContext, 'GET', url);
		mappings.value = response;
	} catch (error) {
		toast.showError(error, 'Failed to load credential mappings');
	}
}

async function createMapping() {
	if (!canCreateMapping.value) return;

	isCreating.value = true;
	try {
		await makeRestApiRequest(rootStore.restApiContext, 'POST', '/user-credential-mappings', {
			customUserId: newMapping.value.customUserId,
			templateCredentialId: newMapping.value.templateCredentialId,
			actualCredentialId: newMapping.value.actualCredentialId,
			description: newMapping.value.description,
		});

		// Reset form
		newMapping.value = {
			customUserId: '',
			templateCredentialId: '',
			actualCredentialId: '',
			description: '',
		};

		// Reload mappings
		await loadMappings();

		toast.showMessage({
			title: 'Mapping created successfully',
			type: 'success',
		});
	} catch (error) {
		toast.showError(error, 'Failed to create mapping');
	} finally {
		isCreating.value = false;
	}
}

async function toggleMappingStatus(mapping: CredentialMapping) {
	mapping.isUpdating = true;
	try {
		await makeRestApiRequest(
			rootStore.restApiContext,
			'PUT',
			`/user-credential-mappings/${mapping.customUserId}/${mapping.templateCredentialId}`,
			{ isActive: !mapping.isActive },
		);

		mapping.isActive = !mapping.isActive;

		toast.showMessage({
			title: `Mapping ${mapping.isActive ? 'activated' : 'deactivated'} successfully`,
			type: 'success',
		});
	} catch (error) {
		toast.showError(error, 'Failed to update mapping');
	} finally {
		mapping.isUpdating = false;
	}
}

async function deleteMapping(mapping: CredentialMapping) {
	mapping.isDeleting = true;
	try {
		await makeRestApiRequest(
			rootStore.restApiContext,
			'DELETE',
			`/user-credential-mappings/${mapping.customUserId}/${mapping.templateCredentialId}`,
		);

		// Remove from local list
		const index = mappings.value.findIndex((m) => m.id === mapping.id);
		if (index > -1) {
			mappings.value.splice(index, 1);
		}

		toast.showMessage({
			title: 'Mapping deleted successfully',
			type: 'success',
		});
	} catch (error) {
		toast.showError(error, 'Failed to delete mapping');
		mapping.isDeleting = false;
	}
}

function getCredentialName(credentialId: string): string {
	const allCredentials = [...templateCredentials.value, ...actualCredentials.value];
	const credential = allCredentials.find((c) => c.id === credentialId);
	return credential ? `${credential.name} (${credential.type})` : credentialId;
}

function onMappingTypeChange(type: 'manual' | 'oauth') {
	mappingType.value = type;
	// Reset form when switching types
	newMapping.value = {
		customUserId: '',
		templateCredentialId: '',
		actualCredentialId: '',
		description: '',
	};
}

function onOAuthMappingCreated(mapping: any) {
	// Reload mappings to show the new one
	loadMappings();
	showOAuthDialog.value = false;
}

// Lifecycle
onMounted(async () => {
	await loadCredentials();
	await loadMappings();
});
</script>

<style scoped>
.credential-mapping-manager {
	padding: 20px;
	max-width: 1200px;
}

.header {
	margin-bottom: 30px;
}

.create-mapping-section,
.mappings-list-section {
	margin-bottom: 40px;
	padding: 20px;
	border: 1px solid var(--color-foreground-base);
	border-radius: 8px;
}

.form-row {
	display: flex;
	gap: 16px;
	margin-bottom: 16px;
}

.form-row > * {
	flex: 1;
}

.form-actions {
	display: flex;
	justify-content: flex-end;
}

.filter-section {
	margin-bottom: 20px;
}

.mappings-table table {
	width: 100%;
	border-collapse: collapse;
}

.mappings-table th,
.mappings-table td {
	padding: 12px;
	text-align: left;
	border-bottom: 1px solid var(--color-foreground-base);
}

.mappings-table th {
	background-color: var(--color-background-light);
	font-weight: 600;
}

.no-mappings {
	text-align: center;
	padding: 40px;
	color: var(--color-text-light);
}

.mapping-type-selection {
	margin-bottom: 24px;
}

.manual-mapping-form,
.oauth-mapping-form {
	margin-top: 16px;
}

.oauth-mapping-form p {
	margin-bottom: 16px;
	color: var(--color-text-base);
}
</style>
