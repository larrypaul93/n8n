/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { CredentialsEntity, AuthenticatedRequest } from '@n8n/db';
import { Container } from '@n8n/di';
import type express from 'express';
import { z } from 'zod';

import { CredentialTypes } from '@/credential-types';
import { EnterpriseCredentialsService } from '@/credentials/credentials.service.ee';
import { CredentialsService } from '@/credentials/credentials.service';
import { CredentialsHelper } from '@/credentials-helper';
import { OAuth1CredentialController } from '@/controllers/oauth/oauth1-credential.controller';
import { OAuth2CredentialController } from '@/controllers/oauth/oauth2-credential.controller';
import { UserCredentialMappingController } from '@/controllers/user-credential-mapping.controller';

import { validCredentialsProperties, validCredentialType } from './credentials.middleware';
import {
	createCredential,
	encryptCredential,
	getCredentials,
	getSharedCredentials,
	removeCredential,
	sanitizeCredentials,
	saveCredential,
	toJsonSchema,
} from './credentials.service';
import type { CredentialTypeRequest, CredentialRequest } from '../../../types';
import { apiKeyHasScope, projectScope } from '../../shared/middlewares/global.middleware';

export = {
	createCredential: [
		validCredentialType,
		validCredentialsProperties,
		apiKeyHasScope('credential:create'),
		async (
			req: CredentialRequest.Create,
			res: express.Response,
		): Promise<express.Response<Partial<CredentialsEntity>>> => {
			try {
				const newCredential = await createCredential(req.body);

				const encryptedData = await encryptCredential(newCredential);

				Object.assign(newCredential, encryptedData);

				const savedCredential = await saveCredential(newCredential, req.user, encryptedData);

				return res.json(sanitizeCredentials(savedCredential));
			} catch ({ message, httpStatusCode }) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				return res.status(httpStatusCode ?? 500).json({ message });
			}
		},
	],
	transferCredential: [
		apiKeyHasScope('credential:move'),
		projectScope('credential:move', 'credential'),
		async (req: CredentialRequest.Transfer, res: express.Response) => {
			const body = z.object({ destinationProjectId: z.string() }).parse(req.body);

			await Container.get(EnterpriseCredentialsService).transferOne(
				req.user,
				req.params.id,
				body.destinationProjectId,
			);

			res.status(204).send();
		},
	],
	deleteCredential: [
		apiKeyHasScope('credential:delete'),
		projectScope('credential:delete', 'credential'),
		async (
			req: CredentialRequest.Delete,
			res: express.Response,
		): Promise<express.Response<Partial<CredentialsEntity>>> => {
			const { id: credentialId } = req.params;
			let credential: CredentialsEntity | undefined;

			if (!['global:owner', 'global:admin'].includes(req.user.role)) {
				const shared = await getSharedCredentials(req.user.id, credentialId);

				if (shared?.role === 'credential:owner') {
					credential = shared.credentials;
				}
			} else {
				credential = (await getCredentials(credentialId)) as CredentialsEntity;
			}

			if (!credential) {
				return res.status(404).json({ message: 'Not Found' });
			}

			await removeCredential(req.user, credential);
			return res.json(sanitizeCredentials(credential));
		},
	],

	getCredentialType: [
		async (req: CredentialTypeRequest.Get, res: express.Response): Promise<express.Response> => {
			const { credentialTypeName } = req.params;

			try {
				Container.get(CredentialTypes).getByName(credentialTypeName);
			} catch (error) {
				return res.status(404).json({ message: 'Not Found' });
			}

			const schema = Container.get(CredentialsHelper)
				.getCredentialsProperties(credentialTypeName)
				.filter((property) => property.type !== 'hidden');

			return res.json(toJsonSchema(schema));
		},
	],

	getMultiUserCredentials: [
		async (req: AuthenticatedRequest, res: express.Response): Promise<express.Response> => {
			try {
				// Only admin and owner users can access multi-user credentials
				if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
					return res
						.status(403)
						.json({ message: 'Only administrators can access multi-user credentials' });
				}

				const credentialsService = Container.get(CredentialsService);
				const credentials = await credentialsService.getMany(req.user, {
					listQueryOptions: {},
					includeScopes: false,
					includeData: false,
					onlySharedWithMe: false,
				});

				console.log('getMultiUserCredentials: total credentials found:', credentials.length);
				console.log(
					'getMultiUserCredentials: credentials with useUserFilter:',
					credentials.filter((c) => c.useUserFilter === true).length,
				);

				// Filter to only return credentials with useUserFilter: true
				const multiUserCredentials = credentials.filter(
					(credential) => credential.useUserFilter === true,
				);

				// Return simplified credential info for dropdown usage in the expected format
				return res.json({
					data: multiUserCredentials.map((credential) => ({
						id: credential.id,
						name: credential.name,
						type: credential.type,
						useUserFilter: credential.useUserFilter,
						createdAt: credential.createdAt,
						updatedAt: credential.updatedAt,
					})),
				});
			} catch (error) {
				return res.status(500).json({ message: 'Internal server error' });
			}
		},
	],

	getMultiUserOAuthCredentials: [
		async (req: AuthenticatedRequest, res: express.Response): Promise<express.Response> => {
			try {
				// Only admin and owner users can access multi-user credentials
				if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
					return res
						.status(403)
						.json({ message: 'Only administrators can access multi-user OAuth credentials' });
				}

				const credentialsService = Container.get(CredentialsService);
				const credentials = await credentialsService.getMany(req.user, {
					listQueryOptions: {},
					includeScopes: false,
					includeData: false,
					onlySharedWithMe: false,
				});

				// OAuth credential types (common ones)
				const oauthTypes = [
					'oauth1',
					'oauth2',
					'google',
					'facebook',
					'github',
					'microsoft',
					'slack',
					'discord',
					'linkedin',
					'twitter',
					'dropbox',
					'salesforce',
					'hubspot',
					'zoom',
					'box',
					'trello',
					'fitbit',
					'flickr',
					'tumblr',
				];

				// Filter to only return OAuth credentials with useUserFilter: true
				const multiUserOAuthCredentials = credentials.filter((credential) => {
					const isOAuth = oauthTypes.some((type) =>
						credential.type.toLowerCase().includes(type.toLowerCase()),
					);
					return credential.useUserFilter === true && isOAuth;
				});

				// Return simplified credential info for dropdown usage in the expected format
				return res.json({
					data: multiUserOAuthCredentials.map((credential) => ({
						id: credential.id,
						name: credential.name,
						type: credential.type,
						useUserFilter: credential.useUserFilter,
						createdAt: credential.createdAt,
						updatedAt: credential.updatedAt,
					})),
				});
			} catch (error) {
				return res.status(500).json({ message: 'Internal server error' });
			}
		},
	],

	createMultiUserCredential: [
		apiKeyHasScope('credential:create'),
		async (
			req: CredentialRequest.CreateMultiUserCredential,
			res: express.Response,
		): Promise<express.Response> => {
			try {
				// Only admin and owner users can create multi-user credentials
				if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
					return res
						.status(403)
						.json({ message: 'Only administrators can create credential mappings' });
				}

				const { customUserId, templateCredentialId, credentialData, description, additionalData } =
					req.body;

				if (!customUserId || !templateCredentialId || !credentialData) {
					return res
						.status(400)
						.json({
							message: 'customUserId, templateCredentialId, and credentialData are required',
						});
				}

				// Verify template credential exists and has useUserFilter enabled
				const credentialsService = Container.get(CredentialsService);
				const templateCredential = await credentialsService.getOne(
					req.user,
					templateCredentialId,
					true,
				);

				if (!templateCredential) {
					return res.status(404).json({ message: 'Template credential not found' });
				}

				if (!templateCredential.useUserFilter) {
					return res
						.status(400)
						.json({ message: 'Template credential is not configured for multi-user use' });
				}

				// Use the UserCredentialMappingController to create the mapping
				const mappingController = Container.get(UserCredentialMappingController);

				const mapping = await mappingController.createMapping(req, {
					customUserId,
					templateCredentialId,
					credentialData,
					description,
					additionalData,
				} as any);

				return res.json(mapping);
			} catch (error) {
				console.error('Error creating multi-user credential:', error);
				if (error.message.includes('not found')) {
					return res.status(404).json({ message: error.message });
				}
				if (error.message.includes('required') || error.message.includes('invalid')) {
					return res.status(400).json({ message: error.message });
				}
				return res.status(500).json({ message: 'Internal server error' });
			}
		},
	],

	getMultiUserOAuthUrl: [
		apiKeyHasScope('credential:create'),
		async (
			req: CredentialRequest.GetMultiUserOAuthUrl,
			res: express.Response,
		): Promise<express.Response> => {
			try {
				// Only admin and owner users can access multi-user credentials
				if (req.user.role !== 'global:admin' && req.user.role !== 'global:owner') {
					return res
						.status(403)
						.json({ message: 'Only administrators can access multi-user OAuth credentials' });
				}

				const { credentialId, customUserId } = req.body;

				if (!credentialId || !customUserId) {
					return res.status(400).json({ message: 'credentialId and customUserId are required' });
				}

				const credentialsService = Container.get(CredentialsService);
				const credential = await credentialsService.getOne(req.user, credentialId, true);

				if (!credential) {
					return res.status(404).json({ message: 'Credential not found' });
				}

				if (!credential.useUserFilter) {
					return res
						.status(400)
						.json({ message: 'Credential is not configured for multi-user use' });
				}

				// Determine OAuth type based on credential type
				let oauthType: 'oauth1' | 'oauth2' | null = null;
				const credentialType = credential.type.toLowerCase();

				// OAuth1 credential types
				if (credentialType.includes('oauth1') || credentialType.includes('twitter')) {
					oauthType = 'oauth1';
				}
				// OAuth2 credential types
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
					return res.status(400).json({ message: 'Credential type does not support OAuth flow' });
				}

				// Generate state parameter with custom user ID
				const state = Buffer.from(
					JSON.stringify({
						credentialId,
						customUserId,
						userId: req.user.id,
						timestamp: Date.now(),
					}),
				).toString('base64');

				// Create mock request for OAuth controllers
				const mockReq = {
					user: req.user,
					query: { id: credentialId, state },
				} as any;

				let authUrl: string;

				if (oauthType === 'oauth1') {
					const oauth1Controller = Container.get(OAuth1CredentialController);
					authUrl = await oauth1Controller.getAuthUri(mockReq);
				} else {
					const oauth2Controller = Container.get(OAuth2CredentialController);
					authUrl = await oauth2Controller.getAuthUri(mockReq);
				}

				return res.json({
					authUrl,
					oauthType,
					state,
					credentialId,
					customUserId,
					message: `Redirect user to authUrl to complete ${oauthType.toUpperCase()} authorization`,
				});
			} catch (error) {
				console.error('Error generating OAuth URL:', error);
				return res.status(500).json({ message: 'Internal server error' });
			}
		},
	],
};
