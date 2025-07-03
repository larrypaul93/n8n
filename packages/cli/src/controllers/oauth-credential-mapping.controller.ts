import { Get, Post, RestController } from '@n8n/decorators';
import { Logger } from '@n8n/backend-common';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { NotFoundError } from '@/errors/response-errors/not-found.error';
import { ForbiddenError } from '@/errors/response-errors/forbidden.error';
import { CredentialsRepository, UserCredentialMappingRepository } from '@n8n/db';
import { CredentialsService } from '@/credentials/credentials.service';
import { ExternalHooks } from '@/external-hooks';
import { OAuth1CredentialController } from '@/controllers/oauth/oauth1-credential.controller';
import { OAuth2CredentialController } from '@/controllers/oauth/oauth2-credential.controller';
import type { OAuthRequest } from '@/requests';
import { randomBytes } from 'crypto';

interface OAuthMappingState {
	templateCredentialId: string;
	customUserId: string;
	description?: string;
	credentialType: string;
	userId: string; // n8n user ID who initiated the flow
}

@RestController('/oauth-credential-mapping')
export class OAuthCredentialMappingController {
	constructor(
		private readonly credentialsRepository: CredentialsRepository,
		private readonly userCredentialMappingRepository: UserCredentialMappingRepository,
		private readonly credentialsService: CredentialsService,
		private readonly externalHooks: ExternalHooks,
		private readonly logger: Logger,
		private readonly oauth1Controller: OAuth1CredentialController,
		private readonly oauth2Controller: OAuth2CredentialController,
	) {}

	/**
	 * Initiate OAuth1 flow for credential mapping
	 */
	@Get('/oauth1/auth')
	async oauth1Auth(req: OAuthRequest.OAuth1CredentialMapping.Auth) {
		// Only admins can create credential mappings
		if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
			throw new ForbiddenError('Only administrators can create credential mappings');
		}

		const { templateCredentialId, customUserId, description } = req.query;

		if (!templateCredentialId || !customUserId) {
			throw new BadRequestError('templateCredentialId and customUserId are required');
		}

		// Verify template credential exists and has useUserFilter enabled
		const templateCredential = await this.credentialsRepository.findOneBy({
			id: templateCredentialId,
		});

		if (!templateCredential) {
			throw new NotFoundError('Template credential not found');
		}

		if (!templateCredential.useUserFilter) {
			throw new BadRequestError('Template credential must have useUserFilter enabled');
		}

		// Create state object with mapping information
		const state: OAuthMappingState = {
			templateCredentialId,
			customUserId,
			description,
			credentialType: templateCredential.type,
			userId: req.user.id,
		};

		// Encode state as base64
		const stateString = Buffer.from(JSON.stringify(state)).toString('base64');

		// Generate OAuth1 authorization URL
		try {
			// Create a temporary credential for OAuth flow
			const tempCredential = await this.credentialsService.createManagedCredential(
				{
					name: `Temp OAuth1 for ${customUserId}`,
					type: templateCredential.type,
					data:
						typeof templateCredential.data === 'string'
							? JSON.parse(templateCredential.data)
							: templateCredential.data,
					useUserFilter: false,
				},
				req.user,
			);

			// Create a mock request for OAuth1 controller
			const oauthReq = {
				user: req.user,
				query: { id: tempCredential.id },
			} as unknown as OAuthRequest.OAuth1Credential.Auth;

			// Use existing OAuth1 flow
			const authUrl = await this.oauth1Controller.getAuthUri(oauthReq);

			return {
				authUrl,
				state: stateString,
				tempCredentialId: tempCredential.id,
			};
		} catch (error) {
			this.logger.error('Failed to initiate OAuth1 flow for credential mapping', {
				error: error.message,
				templateCredentialId,
				customUserId,
			});
			throw new BadRequestError(`Failed to initiate OAuth1 flow: ${error.message}`);
		}
	}

	/**
	 * Handle OAuth1 callback for credential mapping
	 * This is a simplified version - in practice, you'd integrate with the existing OAuth callback flow
	 */
	@Get('/oauth1/callback')
	async oauth1Callback(req: OAuthRequest.OAuth1CredentialMapping.Callback) {
		// For now, return a message indicating this needs to be integrated with existing OAuth flow
		return {
			success: false,
			message:
				'OAuth1 callback integration pending - use existing OAuth flow with custom state handling',
		};
	}

	/**
	 * Initiate OAuth2 flow for credential mapping
	 */
	@Get('/oauth2/auth')
	async oauth2Auth(req: OAuthRequest.OAuth2CredentialMapping.Auth) {
		// Only admins can create credential mappings
		if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
			throw new ForbiddenError('Only administrators can create credential mappings');
		}

		const { templateCredentialId, customUserId, description } = req.query;

		if (!templateCredentialId || !customUserId) {
			throw new BadRequestError('templateCredentialId and customUserId are required');
		}

		// Verify template credential exists and has useUserFilter enabled
		const templateCredential = await this.credentialsRepository.findOneBy({
			id: templateCredentialId,
		});

		if (!templateCredential) {
			throw new NotFoundError('Template credential not found');
		}

		if (!templateCredential.useUserFilter) {
			throw new BadRequestError('Template credential must have useUserFilter enabled');
		}

		// Create state object with mapping information
		const state: OAuthMappingState = {
			templateCredentialId,
			customUserId,
			description,
			credentialType: templateCredential.type,
			userId: req.user.id,
		};

		// Encode state as base64
		const stateString = Buffer.from(JSON.stringify(state)).toString('base64');

		// Generate OAuth2 authorization URL
		try {
			// Create a temporary credential for OAuth flow
			const tempCredential = await this.credentialsService.createManagedCredential(
				{
					name: `Temp OAuth2 for ${customUserId}`,
					type: templateCredential.type,
					data:
						typeof templateCredential.data === 'string'
							? JSON.parse(templateCredential.data)
							: templateCredential.data,
					useUserFilter: false,
				},
				req.user,
			);

			// Create a mock request for OAuth2 controller
			const oauthReq = {
				user: req.user,
				query: { id: tempCredential.id },
			} as unknown as OAuthRequest.OAuth2Credential.Auth;

			// Use existing OAuth2 flow
			const authUrl = await this.oauth2Controller.getAuthUri(oauthReq);

			return {
				authUrl,
				state: stateString,
				tempCredentialId: tempCredential.id,
			};
		} catch (error) {
			this.logger.error('Failed to initiate OAuth2 flow for credential mapping', {
				error: error.message,
				templateCredentialId,
				customUserId,
			});
			throw new BadRequestError(`Failed to initiate OAuth2 flow: ${error.message}`);
		}
	}

	/**
	 * Handle OAuth2 callback for credential mapping
	 * This is a simplified version - in practice, you'd integrate with the existing OAuth callback flow
	 */
	@Get('/oauth2/callback')
	async oauth2Callback(req: OAuthRequest.OAuth2CredentialMapping.Callback) {
		// For now, return a message indicating this needs to be integrated with existing OAuth flow
		return {
			success: false,
			message:
				'OAuth2 callback integration pending - use existing OAuth flow with custom state handling',
		};
	}
}
