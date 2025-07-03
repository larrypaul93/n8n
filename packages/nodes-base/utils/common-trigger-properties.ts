import type { INodeProperties } from 'n8n-workflow';

/**
 * Common property for configuring user ID extraction in trigger nodes
 * This enables multi-user workflow support where different users can execute
 * the same workflow using their own credentials
 */
export const userIdExtractionProperty: INodeProperties = {
	displayName: 'User ID Extraction',
	name: 'userIdExtraction',
	type: 'fixedCollection',
	default: { enabled: false },
	description: 'Configure how to extract user ID for multi-user credential resolution',
	options: [
		{
			name: 'enabled',
			displayName: 'Enable User ID Extraction',
			values: [
				{
					displayName: 'Enable',
					name: 'enable',
					type: 'boolean',
					default: false,
					description: 'Whether to extract user ID from trigger data for multi-user workflows',
				},
				{
					displayName: 'User ID Field Path',
					name: 'fieldPath',
					type: 'string',
					default: 'userId',
					placeholder: 'e.g. userId, user.id, payload.customerId',
					description: 'Path to the user ID field in the trigger data (supports dot notation)',
					displayOptions: {
						show: {
							enable: [true],
						},
					},
				},
				{
					displayName: 'Fallback User ID',
					name: 'fallbackUserId',
					type: 'string',
					default: '',
					placeholder: 'e.g. default-user, guest',
					description: 'User ID to use if extraction fails (optional)',
					displayOptions: {
						show: {
							enable: [true],
						},
					},
				},
			],
		},
	],
};

/**
 * Simplified version for basic use cases - just a field path
 */
export const simpleUserIdProperty: INodeProperties = {
	displayName: 'User ID Field',
	name: 'userIdField',
	type: 'string',
	default: '',
	placeholder: 'e.g. userId, user.id, customerId',
	description:
		'Field path to extract user ID from trigger data for multi-user workflows (leave empty to disable)',
};

/**
 * Extract user ID from trigger data based on node configuration
 */
export function extractUserIdFromTriggerData(
	triggerData: any,
	nodeParameters: any,
	useSimpleProperty = false,
): string | undefined {
	if (useSimpleProperty) {
		// Simple property version
		const fieldPath = nodeParameters.userIdField as string;
		if (!fieldPath) return undefined;

		return getValueByPath(triggerData, fieldPath);
	} else {
		// Full property version
		const config = nodeParameters.userIdExtraction as any;
		if (!config?.enabled?.enable) return undefined;

		const fieldPath = config.enabled.fieldPath as string;
		const fallbackUserId = config.enabled.fallbackUserId as string;

		if (!fieldPath) return fallbackUserId || undefined;

		const extractedUserId = getValueByPath(triggerData, fieldPath);
		return extractedUserId || fallbackUserId || undefined;
	}
}

/**
 * Get value from object using dot notation path
 */
function getValueByPath(obj: any, path: string): string | undefined {
	if (!obj || !path) return undefined;

	try {
		const keys = path.split('.');
		let current = obj;

		for (const key of keys) {
			if (current === null || current === undefined) return undefined;
			current = current[key];
		}

		return current ? String(current) : undefined;
	} catch (error) {
		return undefined;
	}
}
