import { AuthenticatedRequest } from '@n8n/db';
import { UserCredentialMappingRepository, CredentialsRepository } from '@n8n/db';
import { Delete, Get, Post, Put, RestController, Body, Param, Query } from '@n8n/decorators';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { NotFoundError } from '@/errors/response-errors/not-found.error';
import { ForbiddenError } from '@/errors/response-errors/forbidden.error';
import { UserCredentialDataService } from '@/credentials/user-credential-data.service';
import type { ICredentialDataDecryptedObject } from 'n8n-workflow';

interface CreateMappingDto {
	customUserId: string;
	templateCredentialId: string;
	credentialData: ICredentialDataDecryptedObject;
	description?: string;
	additionalData?: Record<string, any>;
}

interface UpdateMappingDto {
	credentialData?: ICredentialDataDecryptedObject;
	description?: string;
	additionalData?: Record<string, any>;
	isActive?: boolean;
}

@RestController('/user-credential-mappings')
export class UserCredentialMappingController {
	constructor(
		private readonly userCredentialMappingRepository: UserCredentialMappingRepository,
		private readonly credentialsRepository: CredentialsRepository,
		private readonly userCredentialDataService: UserCredentialDataService,
	) {}

	/**
	 * Create a new user credential mapping
	 */
	@Post('/')
	async createMapping(req: AuthenticatedRequest, @Body payload: CreateMappingDto) {
		// Only admins and owners can create mappings
		if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
			throw new ForbiddenError('Only administrators can create credential mappings');
		}

		if (!payload.customUserId || !payload.templateCredentialId || !payload.credentialData) {
			throw new BadRequestError(
				'customUserId, templateCredentialId, and credentialData are required',
			);
		}

		// Verify template credential exists and has useUserFilter enabled
		const templateCredential = await this.credentialsRepository.findOneBy({
			id: payload.templateCredentialId,
		});

		if (!templateCredential) {
			throw new NotFoundError(
				`Template credential with ID "${payload.templateCredentialId}" not found`,
			);
		}

		if (!templateCredential.useUserFilter) {
			throw new BadRequestError('Template credential must have useUserFilter enabled');
		}

		try {
			// Encrypt the credential data
			const encryptedData = this.userCredentialDataService.encryptCredentialData(
				payload.credentialData,
			);

			const mapping = await this.userCredentialMappingRepository.createOrUpdateMapping(
				payload.customUserId,
				payload.templateCredentialId,
				encryptedData,
				payload.additionalData,
				payload.description,
			);

			return {
				id: mapping.id,
				customUserId: mapping.customUserId,
				templateCredentialId: mapping.templateCredentialId,
				description: mapping.description,
				additionalData: mapping.additionalData,
				isActive: mapping.isActive,
				createdAt: mapping.createdAt,
				updatedAt: mapping.updatedAt,
			};
		} catch (error) {
			throw new BadRequestError(`Failed to create mapping: ${error.message}`);
		}
	}

	/**
	 * Get all mappings for a specific custom user ID
	 */
	@Get('/user/:customUserId')
	async getMappingsByUser(
		req: AuthenticatedRequest,
		@Param('customUserId') customUserId: string,
		@Query query: { includeData?: string },
	) {
		// Only admins and owners can view mappings
		if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
			throw new ForbiddenError('Only administrators can view credential mappings');
		}

		const mappings = await this.userCredentialMappingRepository.findByCustomUserId(customUserId);

		// Include decrypted credential data if requested
		if (query.includeData === 'true') {
			return mappings.map((mapping) => {
				const response: any = {
					id: mapping.id,
					customUserId: mapping.customUserId,
					templateCredentialId: mapping.templateCredentialId,
					hasCredentialData: !!mapping.encryptedData,
					description: mapping.description,
					additionalData: mapping.additionalData,
					isActive: mapping.isActive,
					createdAt: mapping.createdAt,
					updatedAt: mapping.updatedAt,
				};

				if (mapping.encryptedData) {
					try {
						const decryptedData = this.userCredentialDataService.decryptCredentialData(
							mapping.encryptedData,
						);
						response.data = decryptedData;
					} catch (error) {
						// If decryption fails, don't include the data field
						response.hasCredentialData = false;
					}
				}

				return response;
			});
		}

		return mappings;
	}

	/**
	 * Get all mappings for a specific template credential
	 */
	@Get('/template/:templateCredentialId')
	async getMappingsByTemplate(
		req: AuthenticatedRequest,
		@Param('templateCredentialId') templateCredentialId: string,
	) {
		// Only admins and owners can view mappings
		if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
			throw new ForbiddenError('Only administrators can view credential mappings');
		}

		const mappings =
			await this.userCredentialMappingRepository.findByTemplateCredentialId(templateCredentialId);
		return mappings;
	}

	/**
	 * Get mapping statistics for a template credential
	 */
	@Get('/template/:templateCredentialId/stats')
	async getMappingStats(
		req: AuthenticatedRequest,
		@Param('templateCredentialId') templateCredentialId: string,
	) {
		// Only admins and owners can view stats
		if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
			throw new ForbiddenError('Only administrators can view credential mapping statistics');
		}

		const stats = await this.userCredentialMappingRepository.getMappingStats(templateCredentialId);
		return stats;
	}

	/**
	 * Update a specific mapping
	 */
	@Put('/:customUserId/:templateCredentialId')
	async updateMapping(
		req: AuthenticatedRequest,
		@Param('customUserId') customUserId: string,
		@Param('templateCredentialId') templateCredentialId: string,
		@Body payload: UpdateMappingDto,
	) {
		// Only admins and owners can update mappings
		if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
			throw new ForbiddenError('Only administrators can update credential mappings');
		}

		// Find existing mapping
		const existingMapping = await this.userCredentialMappingRepository.findOne({
			where: { customUserId, templateCredentialId },
		});

		if (!existingMapping) {
			throw new NotFoundError('Mapping not found');
		}

		// Update fields
		if (payload.credentialData !== undefined) {
			const encryptedData = this.userCredentialDataService.encryptCredentialData(
				payload.credentialData,
			);
			existingMapping.encryptedData = encryptedData;
		}
		if (payload.description !== undefined) {
			existingMapping.description = payload.description;
		}
		if (payload.additionalData !== undefined) {
			existingMapping.additionalData = payload.additionalData;
		}
		if (payload.isActive !== undefined) {
			existingMapping.isActive = payload.isActive;
		}

		existingMapping.updatedAt = new Date();

		const updatedMapping = await this.userCredentialMappingRepository.save(existingMapping);

		return {
			id: updatedMapping.id,
			customUserId: updatedMapping.customUserId,
			templateCredentialId: updatedMapping.templateCredentialId,
			description: updatedMapping.description,
			additionalData: updatedMapping.additionalData,
			isActive: updatedMapping.isActive,
			createdAt: updatedMapping.createdAt,
			updatedAt: updatedMapping.updatedAt,
		};
	}

	/**
	 * Deactivate a mapping (soft delete)
	 */
	@Delete('/:customUserId/:templateCredentialId/deactivate')
	async deactivateMapping(
		req: AuthenticatedRequest,
		@Param('customUserId') customUserId: string,
		@Param('templateCredentialId') templateCredentialId: string,
	) {
		// Only admins and owners can deactivate mappings
		if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
			throw new ForbiddenError('Only administrators can deactivate credential mappings');
		}

		const success = await this.userCredentialMappingRepository.deactivateMapping(
			customUserId,
			templateCredentialId,
		);

		if (!success) {
			throw new NotFoundError('Mapping not found');
		}

		return { success: true, message: 'Mapping deactivated successfully' };
	}

	/**
	 * Delete a mapping permanently
	 */
	@Delete('/:customUserId/:templateCredentialId')
	async deleteMapping(
		req: AuthenticatedRequest,
		@Param('customUserId') customUserId: string,
		@Param('templateCredentialId') templateCredentialId: string,
	) {
		// Only admins and owners can delete mappings
		if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
			throw new ForbiddenError('Only administrators can delete credential mappings');
		}

		const success = await this.userCredentialMappingRepository.deleteMapping(
			customUserId,
			templateCredentialId,
		);

		if (!success) {
			throw new NotFoundError('Mapping not found');
		}

		return { success: true, message: 'Mapping deleted successfully' };
	}

	/**
	 * Resolve credential mapping for a user and template credential
	 * This is mainly for testing/debugging purposes
	 */
	@Get('/resolve/:customUserId/:templateCredentialId')
	async resolveCredential(
		req: AuthenticatedRequest,
		@Param('customUserId') customUserId: string,
		@Param('templateCredentialId') templateCredentialId: string,
		@Query query: { includeData?: string },
	) {
		// Only admins and owners can resolve mappings
		if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
			throw new ForbiddenError('Only administrators can resolve credential mappings');
		}

		const mapping = await this.userCredentialMappingRepository.findUserCredentialMapping(
			customUserId,
			templateCredentialId,
		);

		if (!mapping) {
			throw new NotFoundError('No mapping found for the specified user and template credential');
		}

		const response: any = {
			id: mapping.id,
			customUserId: mapping.customUserId,
			templateCredentialId: mapping.templateCredentialId,
			hasCredentialData: !!mapping.encryptedData,
			description: mapping.description,
			additionalData: mapping.additionalData,
			isActive: mapping.isActive,
			createdAt: mapping.createdAt,
			updatedAt: mapping.updatedAt,
		};

		// Include decrypted credential data if requested
		if (query.includeData === 'true' && mapping.encryptedData) {
			try {
				const decryptedData = this.userCredentialDataService.decryptCredentialData(
					mapping.encryptedData,
				);
				response.data = decryptedData;
			} catch (error) {
				throw new BadRequestError('Failed to decrypt credential data');
			}
		}

		return response;
	}

	/**
	 * Initiate OAuth flow for credential mapping
	 */
	@Post('/oauth/initiate')
	async initiateOAuthMapping(
		req: AuthenticatedRequest,
		@Body payload: {
			templateCredentialId: string;
			customUserId: string;
			description?: string;
		},
	) {
		// Only admins and owners can create mappings
		if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
			throw new ForbiddenError('Only administrators can create credential mappings');
		}

		const { templateCredentialId, customUserId, description } = payload;

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

		// Determine OAuth type based on credential type
		const credentialType = templateCredential.type.toLowerCase();
		let oauthType: 'oauth1' | 'oauth2' | null = null;

		// Common OAuth1 credential types
		if (
			credentialType.includes('oauth1') ||
			credentialType.includes('twitter') ||
			credentialType.includes('tumblr')
		) {
			oauthType = 'oauth1';
		}
		// Common OAuth2 credential types
		else if (
			credentialType.includes('oauth2') ||
			credentialType.includes('google') ||
			credentialType.includes('facebook') ||
			credentialType.includes('github') ||
			credentialType.includes('microsoft') ||
			credentialType.includes('slack') ||
			credentialType.includes('discord') ||
			credentialType.includes('linkedin')
		) {
			oauthType = 'oauth2';
		}

		if (!oauthType) {
			throw new BadRequestError('Credential type does not support OAuth flow');
		}

		// Generate authorization URL based on OAuth type
		const baseUrl = process.env.WEBHOOK_URL || 'http://localhost:5678';
		const state = Buffer.from(
			JSON.stringify({
				templateCredentialId,
				customUserId,
				description,
				credentialType: templateCredential.type,
				userId: req.user.id,
			}),
		).toString('base64');

		const authUrl =
			`${baseUrl}/rest/oauth-credential-mapping/${oauthType}/auth?` +
			`templateCredentialId=${encodeURIComponent(templateCredentialId)}&` +
			`customUserId=${encodeURIComponent(customUserId)}&` +
			`description=${encodeURIComponent(description || '')}`;

		return {
			authUrl,
			oauthType,
			state,
			templateCredentialId,
			customUserId,
			message: `Redirect user to authUrl to complete ${oauthType.toUpperCase()} authorization`,
		};
	}

	/**
	 * Get OAuth credential types that support mapping
	 */
	@Get('/oauth/supported-types')
	async getSupportedOAuthTypes(req: AuthenticatedRequest) {
		// Only admins and owners can view this
		if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
			throw new ForbiddenError('Only administrators can view OAuth credential types');
		}

		return {
			oauth1: ['twitterOAuth1Api', 'tumblrOAuth1Api', 'trelloApi', 'fitbitApi', 'flickrApi'],
			oauth2: [
				'googleOAuth2Api',
				'facebookGraphApi',
				'githubOAuth2Api',
				'microsoftOAuth2Api',
				'slackOAuth2Api',
				'discordOAuth2Api',
				'linkedInOAuth2Api',
				'dropboxOAuth2Api',
				'boxOAuth2Api',
				'salesforceOAuth2Api',
				'hubspotOAuth2Api',
				'zoomOAuth2Api',
			],
		};
	}
}
