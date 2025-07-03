import type { ILoadOptionsFunctions, INodeListSearchResult, INodeProperties } from 'n8n-workflow';

import { apiRequestAllItems } from './GenericFunctions';
import { Console } from 'node:console';

type DataItemsResponse<T> = {
	data: T[];
};

interface PartialCredential {
	id: string;
	name: string;
	type: string;
	useUserFilter?: boolean;
}

/**
 * A helper to populate credential lists.
 * Uses the new multi-user credentials API endpoint.
 */
export async function searchCredentials(
	this: ILoadOptionsFunctions,
	query?: string,
): Promise<INodeListSearchResult> {
	try {
		const searchResults = (await apiRequestAllItems.call(
			this,
			'GET',
			'credentials/multi-user',
			{},
		)) as PartialCredential[];

		// console.log('searchCredentials: searchResults', searchResults);

		// Map the credentials list against a simple name/id filter, and sort
		// with the latest on top. Only multi-user credentials are returned by the API.
		// console.log('searchCredentials: searchResults', searchResults);
		const credentials = searchResults
			.map((c: PartialCredential) => ({
				name: `${c.name} (${c.type}) - ${c.id}`,
				value: c.id,
			}))
			.filter(
				(c) =>
					!query ||
					c.name.toLowerCase().includes(query.toLowerCase()) ||
					c.value?.toString() === query,
			)
			.sort((a, b) => a.name.localeCompare(b.name));

		return {
			results:
				credentials.length > 0
					? credentials
					: [
							{
								name: 'No multi-user credentials found',
								value: '',
							},
							{
								name: '💡 Create credentials with useUserFilter: true',
								value: '',
							},
						],
		};
	} catch (error) {
		// Log the error for debugging
		console.error('searchCredentials: API call failed', error);

		// Fallback to helpful messages if API call fails
		return {
			results: [
				{
					name: '⚠️ Could not load credentials',
					value: '',
				},
				{
					name: '👆 Switch to "ID" mode above to enter credential ID',
					value: '',
				},
				{
					name: '💡 Ensure you have admin permissions',
					value: '',
				},
				{
					name: '🔍 Check console for detailed error',
					value: '',
				},
			],
		};
	}
}

/**
 * A helper to populate OAuth-enabled credential lists for OAuth URL generation.
 * Uses the new multi-user OAuth credentials API endpoint.
 */
export async function searchOAuthCredentials(
	this: ILoadOptionsFunctions,
	query?: string,
): Promise<INodeListSearchResult> {
	try {
		const searchResults = (await apiRequestAllItems.call(
			this,
			'GET',
			'credentials/multi-user/oauth',
			{},
		)) as PartialCredential[];

		// Map the OAuth credentials list against a simple name/id filter, and sort
		// with the latest on top. Only OAuth multi-user credentials are returned by the API.
		const credentials = searchResults
			.map((c: PartialCredential) => ({
				name: `${c.name} (${c.type}) - ${c.id}`,
				value: c.id,
			}))
			.filter(
				(c) =>
					!query ||
					c.name.toLowerCase().includes(query.toLowerCase()) ||
					c.value?.toString() === query,
			)
			.sort((a, b) => a.name.localeCompare(b.name));

		return {
			results:
				credentials.length > 0
					? credentials
					: [
							{
								name: 'No OAuth multi-user credentials found',
								value: '',
							},
							{
								name: '💡 Create OAuth credentials with useUserFilter: true',
								value: '',
							},
							{
								name: '📋 Supported: Google, GitHub, Slack, Microsoft, etc.',
								value: '',
							},
						],
		};
	} catch (error) {
		// Log the error for debugging
		console.error('searchOAuthCredentials: API call failed', error);

		// Fallback to helpful messages if API call fails
		return {
			results: [
				{
					name: '⚠️ Could not load OAuth credentials',
					value: '',
				},
				{
					name: '👆 Switch to "ID" mode above to enter credential ID',
					value: '',
				},
				{
					name: '💡 Ensure you have admin permissions',
					value: '',
				},
				{
					name: '🔍 Check console for detailed error',
					value: '',
				},
			],
		};
	}
}

/**
 * A resourceLocator to enable looking up multi-user credentials by their ID.
 * This object can be used as a base and then extended as needed.
 */
export const credentialIdLocator: INodeProperties = {
	displayName: 'Template Credential',
	name: 'templateCredentialId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	description: 'Template credential with multi-user support enabled (useUserFilter: true)',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select a multi-user credential...',
			initType: 'credential',
			typeOptions: {
				searchListMethod: 'searchCredentials',
				searchFilterRequired: false,
				searchable: true,
			},
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '[0-9a-zA-Z-_]{1,}',
						errorMessage: 'Not a valid Credential ID',
					},
				},
			],
			placeholder: 'cred_abc123',
			hint: 'Enter the ID of a template credential with useUserFilter enabled',
		},
	],
};

/**
 * A resourceLocator specifically for OAuth-enabled multi-user credentials.
 */
export const oauthCredentialIdLocator: INodeProperties = {
	displayName: 'OAuth Template Credential',
	name: 'templateCredentialId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	description: 'OAuth-enabled template credential with multi-user support (useUserFilter: true)',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select an OAuth multi-user credential...',
			initType: 'credential',
			typeOptions: {
				searchListMethod: 'searchOAuthCredentials',
				searchFilterRequired: false,
				searchable: true,
			},
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '[0-9a-zA-Z-_]{1,}',
						errorMessage: 'Not a valid Credential ID',
					},
				},
			],
			placeholder: 'cred_oauth_123',
			hint: 'Enter the ID of an OAuth credential with useUserFilter enabled (Google, GitHub, Slack, etc.)',
		},
	],
};
