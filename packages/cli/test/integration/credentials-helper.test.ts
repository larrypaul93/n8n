import { createTeamProject, linkUserToProject } from '@n8n/backend-test-utils';
import { randomCredentialPayload } from '@n8n/backend-test-utils';
import { testDb } from '@n8n/backend-test-utils';
import type { User } from '@n8n/db';
import { Container } from '@n8n/di';

import { CredentialsHelper } from '@/credentials-helper';

import { saveCredential } from './shared/db/credentials';
import { createOwner, createAdmin, createMember } from './shared/db/users';

let credentialHelper: CredentialsHelper;
let owner: User;
let admin: User;
let member: User;

beforeAll(async () => {
	await testDb.init();

	credentialHelper = Container.get(CredentialsHelper);
	owner = await createOwner();
	admin = await createAdmin();
	member = await createMember();
});

afterAll(async () => {
	await testDb.terminate();
});

describe('CredentialsHelper', () => {
	describe('credentialOwnedBySuperUsers', () => {
		test.each([
			{
				testName: 'owners are super users',
				user: () => owner,
				credentialRole: 'credential:owner',
				expectedResult: true,
			} as const,
			{
				testName: 'admins are super users',
				user: () => admin,
				credentialRole: 'credential:owner',
				expectedResult: true,
			} as const,
			{
				testName: 'owners need to own the credential',
				user: () => owner,
				credentialRole: 'credential:user',
				expectedResult: false,
			} as const,
			{
				testName: 'admins need to own the credential',
				user: () => admin,
				credentialRole: 'credential:user',
				expectedResult: false,
			} as const,
			{
				testName: 'members are no super users',
				user: () => member,
				credentialRole: 'credential:owner',
				expectedResult: false,
			} as const,
		])('$testName', async ({ user, credentialRole, expectedResult }) => {
			const credential = await saveCredential(randomCredentialPayload(), {
				user: user(),
				role: credentialRole,
			});

			const result = await credentialHelper.credentialCanUseExternalSecrets(credential);

			expect(result).toBe(expectedResult);
		});

		test('credential in team project with instance owner as an admin can use external secrets', async () => {
			const teamProject = await createTeamProject();
			const [credential] = await Promise.all([
				await saveCredential(randomCredentialPayload(), {
					project: teamProject,
					role: 'credential:owner',
				}),
				await linkUserToProject(owner, teamProject, 'project:admin'),
				await linkUserToProject(member, teamProject, 'project:admin'),
			]);

			const result = await credentialHelper.credentialCanUseExternalSecrets(credential);

			expect(result).toBe(true);
		});

		test('credential in team project with instance admin as an admin can use external secrets', async () => {
			const teamProject = await createTeamProject();
			const [credential] = await Promise.all([
				await saveCredential(randomCredentialPayload(), {
					project: teamProject,
					role: 'credential:owner',
				}),
				await linkUserToProject(admin, teamProject, 'project:admin'),
				await linkUserToProject(member, teamProject, 'project:admin'),
			]);

			const result = await credentialHelper.credentialCanUseExternalSecrets(credential);

			expect(result).toBe(true);
		});

		test('credential in team project with instance owner as an editor cannot use external secrets', async () => {
			const teamProject = await createTeamProject();
			const [credential] = await Promise.all([
				await saveCredential(randomCredentialPayload(), {
					project: teamProject,
					role: 'credential:owner',
				}),
				await linkUserToProject(owner, teamProject, 'project:editor'),
				await linkUserToProject(member, teamProject, 'project:admin'),
			]);

			const result = await credentialHelper.credentialCanUseExternalSecrets(credential);

			expect(result).toBe(false);
		});

		test('credential in team project with instance admin as an editor cannot use external secrets', async () => {
			const teamProject = await createTeamProject();
			const [credential] = await Promise.all([
				await saveCredential(randomCredentialPayload(), {
					project: teamProject,
					role: 'credential:owner',
				}),
				await linkUserToProject(admin, teamProject, 'project:editor'),
				await linkUserToProject(member, teamProject, 'project:admin'),
			]);

			const result = await credentialHelper.credentialCanUseExternalSecrets(credential);

			expect(result).toBe(false);
		});

		test('credential in team project with no instance admin or owner as part of the project cannot use external secrets', async () => {
			const teamProject = await createTeamProject();
			const [credential] = await Promise.all([
				await saveCredential(randomCredentialPayload(), {
					project: teamProject,
					role: 'credential:owner',
				}),
				await linkUserToProject(member, teamProject, 'project:admin'),
			]);

			const result = await credentialHelper.credentialCanUseExternalSecrets(credential);

			expect(result).toBe(false);
		});
	});

	describe('getCredentials with user filtering', () => {
		test('should use specific credential when useUserFilter is false', async () => {
			const credential = await saveCredential(
				{ ...randomCredentialPayload(), useUserFilter: false },
				{ user: owner, role: 'credential:owner' },
			);

			// Debug: Check if useUserFilter was saved correctly
			console.log('Saved credential useUserFilter:', credential.useUserFilter);

			const nodeCredential = { id: credential.id, name: credential.name };
			const result = await credentialHelper.getCredentials(
				nodeCredential,
				credential.type,
				owner.id,
			);

			expect(result.id).toBe(credential.id);
			expect(result.name).toBe(credential.name);
		});

		test('should find user-specific credential when useUserFilter is true', async () => {
			// Create a credential with useUserFilter enabled
			const userSpecificCredential = await saveCredential(
				{ ...randomCredentialPayload(), useUserFilter: true },
				{ user: member, role: 'credential:owner' },
			);

			// Create another credential of the same type with useUserFilter disabled
			const sharedCredential = await saveCredential(
				{ ...randomCredentialPayload(), type: userSpecificCredential.type, useUserFilter: false },
				{ user: owner, role: 'credential:owner' },
			);

			// Debug: Check the saved credentials
			console.log('User-specific credential:', {
				id: userSpecificCredential.id,
				type: userSpecificCredential.type,
				useUserFilter: userSpecificCredential.useUserFilter,
				ownerId: member.id,
			});
			console.log('Shared credential:', {
				id: sharedCredential.id,
				type: sharedCredential.type,
				useUserFilter: sharedCredential.useUserFilter,
				ownerId: owner.id,
			});

			// When requesting with the shared credential ID but with a userId,
			// it should return the user-specific credential instead
			const nodeCredential = { id: sharedCredential.id, name: sharedCredential.name };
			const result = await credentialHelper.getCredentials(
				nodeCredential,
				userSpecificCredential.type,
				member.id,
			);

			console.log('Result credential:', {
				id: result.id,
				name: result.name,
			});

			// Should get the user-specific credential, not the shared one
			expect(result.id).toBe(userSpecificCredential.id);
			expect(result.name).toBe(userSpecificCredential.name);
		});

		test('should use shared credential when no user-specific credential exists', async () => {
			const sharedCredential = await saveCredential(
				{ ...randomCredentialPayload(), useUserFilter: false },
				{ user: owner, role: 'credential:owner' },
			);

			const nodeCredential = { id: sharedCredential.id, name: sharedCredential.name };
			const result = await credentialHelper.getCredentials(
				nodeCredential,
				sharedCredential.type,
				member.id,
			);

			expect(result.id).toBe(sharedCredential.id);
			expect(result.name).toBe(sharedCredential.name);
		});

		test('should throw error when user-specific credential is required but not found', async () => {
			const userSpecificCredential = await saveCredential(
				{ ...randomCredentialPayload(), useUserFilter: true },
				{ user: owner, role: 'credential:owner' },
			);

			const nodeCredential = { id: userSpecificCredential.id, name: userSpecificCredential.name };

			await expect(
				credentialHelper.getCredentials(nodeCredential, userSpecificCredential.type, member.id),
			).rejects.toThrow('No user-specific credentials');
		});
	});
});
