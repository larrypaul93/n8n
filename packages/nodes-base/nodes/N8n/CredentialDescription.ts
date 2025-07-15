import type { INodeProperties } from 'n8n-workflow';

import { parseAndSetBodyJson } from './GenericFunctions';
import { credentialIdLocator, oauthCredentialIdLocator } from './CredentialLocator';

export const credentialOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'create',
		displayOptions: {
			show: {
				resource: ['credential'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a credential',
				routing: {
					request: {
						method: 'POST',
						url: '/credentials',
					},
				},
			},
			{
				name: 'Create Multi User Credential',
				value: 'createMultiUser',
				action: 'Create a multi-user credential',
				routing: {
					request: {
						method: 'POST',
						url: '/credentials/multi-user',
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a credential',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/credentials/{{ $parameter.credentialId }}',
					},
				},
			},
			{
				name: 'Get OAuth URL for Multi User Credential',
				value: 'getMultiUserOAuthUrl',
				action: 'Get OAuth authorization URL for multi-user credential',
				routing: {
					request: {
						method: 'POST',
						url: '/credentials/multi-user/oauth/url',
					},
				},
			},
			{
				name: 'Get Multi User Credentials',
				value: 'getMultiUser',
				action: 'Get saved multi-user credentials',
				routing: {
					request: {
						method: 'GET',
						url: '=/user-credential-mappings/resolve/{{ $parameter.customUserId }}/{{ $parameter.templateCredentialId }}',
					},
				},
			},
			{
				name: 'Get Schema',
				value: 'getSchema',
				action: 'Get credential data schema for type',
				routing: {
					request: {
						method: 'GET',
						url: '=/credentials/schema/{{ $parameter.credentialTypeName }}',
					},
				},
			},
		],
	},
];

const createOperation: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		placeholder: 'e.g. n8n account',
		required: true,
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['create'],
			},
		},
		routing: {
			request: {
				body: {
					name: '={{ $value }}',
				},
			},
		},
		description: 'Name of the new credential',
	},
	{
		displayName: 'Credential Type',
		name: 'credentialTypeName',
		type: 'string',
		placeholder: 'e.g. n8nApi',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['create'],
			},
		},
		routing: {
			request: {
				body: {
					type: '={{ $value }}',
				},
			},
		},
		description:
			"The available types depend on nodes installed on the n8n instance. Some built-in types include e.g. 'githubApi', 'notionApi', and 'slackApi'.",
	},
	{
		displayName: 'Data',
		name: 'data',
		type: 'json',
		default: '',
		placeholder:
			'// e.g. for n8nApi \n{\n  "apiKey": "my-n8n-api-key",\n  "baseUrl": "https://<name>.app.n8n.cloud/api/v1",\n}',
		required: true,
		typeOptions: {
			alwaysOpenEditWindow: true,
		},
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['create'],
			},
		},
		routing: {
			send: {
				// Validate that the 'data' property is parseable as JSON and
				// set it into the request as body.data.
				preSend: [parseAndSetBodyJson('data', 'data')],
			},
		},
		description:
			"A valid JSON object with properties required for this Credential Type. To see the expected format, you can use 'Get Schema' operation.",
	},
];

const deleteOperation: INodeProperties[] = [
	{
		displayName: 'Credential ID',
		name: 'credentialId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['delete'],
			},
		},
	},
];

const getSchemaOperation: INodeProperties[] = [
	{
		displayName: 'Credential Type',
		name: 'credentialTypeName',
		default: '',
		placeholder: 'e.g. n8nApi',
		required: true,
		type: 'string',
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['getSchema'],
			},
		},
		description:
			"The available types depend on nodes installed on the n8n instance. Some built-in types include e.g. 'githubApi', 'notionApi', and 'slackApi'.",
	},
];

const createMultiUserOperation: INodeProperties[] = [
	{
		displayName: 'Custom User ID',
		name: 'customUserId',
		type: 'string',
		default: '',
		placeholder: 'e.g. user123, customer456',
		required: true,
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['createMultiUser'],
			},
		},
		routing: {
			request: {
				body: {
					customUserId: '={{ $value }}',
				},
			},
		},
		description: 'Custom user identifier for this credential mapping (not the n8n user ID)',
	},
	{
		...credentialIdLocator,
		required: true,
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['createMultiUser'],
			},
		},
		routing: {
			request: {
				body: {
					templateCredentialId: '={{ $value }}',
				},
			},
		},
	},
	{
		displayName: 'Credential Data',
		name: 'credentialData',
		type: 'json',
		default: '',
		placeholder:
			'{\n  "apiKey": "user-specific-api-key",\n  "baseUrl": "https://api.example.com"\n}',
		required: true,
		typeOptions: {
			alwaysOpenEditWindow: true,
		},
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['createMultiUser'],
			},
		},
		routing: {
			send: {
				preSend: [parseAndSetBodyJson('credentialData', 'credentialData')],
			},
		},
		description: 'User-specific credential data as a JSON object',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '',
		placeholder: 'e.g. API credentials for user123',
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['createMultiUser'],
			},
		},
		routing: {
			request: {
				body: {
					description: '={{ $value }}',
				},
			},
		},
		description: 'Optional description for this credential mapping',
	},
];

const getMultiUserOAuthUrlOperation: INodeProperties[] = [
	{
		...oauthCredentialIdLocator,
		required: true,
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['getMultiUserOAuthUrl'],
			},
		},
		routing: {
			request: {
				body: {
					credentialId: '={{ $value }}',
				},
			},
		},
	},
	{
		displayName: 'Custom User ID',
		name: 'customUserId',
		type: 'string',
		default: '',
		placeholder: 'e.g. user123, customer456',
		required: true,
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['getMultiUserOAuthUrl'],
			},
		},
		routing: {
			request: {
				body: {
					customUserId: '={{ $value }}',
				},
			},
		},
		description: 'Custom user identifier for this OAuth flow',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '',
		placeholder: 'e.g. OAuth setup for user123',
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['getMultiUserOAuthUrl'],
			},
		},
		routing: {
			request: {
				body: {
					description: '={{ $value }}',
				},
			},
		},
		description: 'Optional description for this OAuth credential mapping',
	},
];

const getMultiUserOperation: INodeProperties[] = [
	{
		displayName: 'Template Credential',
		name: 'templateCredentialId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['getMultiUser'],
			},
		},
		description: 'The multi-user template credential to retrieve saved data for',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a template credential...',
				typeOptions: {
					searchListMethod: 'searchCredentials',
					searchable: true,
				},
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. cred_abc123',
			},
		],
	},
	{
		displayName: 'Custom User ID',
		name: 'customUserId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['credential'],
				operation: ['getMultiUser'],
			},
		},
		description: 'The custom user ID to retrieve saved credential data for',
		placeholder: 'e.g. user123, customer456',
	},
];

export const credentialFields: INodeProperties[] = [
	...createOperation,
	...createMultiUserOperation,
	...deleteOperation,
	...getMultiUserOperation,
	...getMultiUserOAuthUrlOperation,
	...getSchemaOperation,
];
