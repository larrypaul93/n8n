import type { INodeProperties, INodeTypeDescription } from 'n8n-workflow';

/**
 * Universal user ID configuration properties that can be injected into any trigger node
 */
export const UNIVERSAL_USER_ID_PROPERTIES: INodeProperties[] = [
	{
		displayName: 'User ID Source',
		name: 'userIdSource',
		type: 'options',
		options: [
			{
				name: 'Extract from Data',
				value: 'extract',
				description: 'Extract user ID from trigger data using a field path',
			},
			{
				name: 'Direct Value',
				value: 'direct',
				description: 'Use a direct user ID value',
			},
			{
				name: 'Disabled',
				value: 'disabled',
				description: 'Disable multi-user support',
			},
		],
		default: 'disabled',
		description: 'How to determine the user ID for multi-user workflows',
	},
	{
		displayName: 'User ID Field Path',
		name: 'userIdFieldPath',
		type: 'string',
		default: '',
		placeholder: 'e.g. userId, user.id, customerId, headers.x-user-id',
		description: 'Dot notation path to extract user ID from trigger data',
		displayOptions: {
			show: {
				userIdSource: ['extract'],
			},
		},
	},
	{
		displayName: 'User ID Value',
		name: 'userIdValue',
		type: 'string',
		default: '',
		placeholder: 'e.g. user123, customer456',
		description: 'Direct user ID value to use for all executions',
		displayOptions: {
			show: {
				userIdSource: ['direct'],
			},
		},
	},
];

/**
 * Legacy property for backward compatibility
 */
export const UNIVERSAL_USER_ID_PROPERTY: INodeProperties = {
	displayName: 'User ID Expression',
	name: 'userIdExpression',
	type: 'string',
	default: '',
	placeholder: 'e.g. {{ $json.userId }}, {{ $json.user.id }}, {{ $json.customerId }}',
	description:
		'Expression to extract user ID from trigger data for multi-user workflows (leave empty to disable)',
	noDataExpression: false, // Allow expressions
};

/**
 * Inject universal trigger properties into a node type description
 * This automatically adds multi-user support to any trigger node
 */
export function injectUniversalTriggerProperties(
	description: INodeTypeDescription,
): INodeTypeDescription {
	// Only inject into trigger nodes
	if (!description.group?.includes('trigger')) {
		return description;
	}

	// Check if the properties already exist to avoid duplicates
	const hasUserIdSource = description.properties?.some((prop) => prop.name === 'userIdSource');
	const hasUserIdExpression = description.properties?.some(
		(prop) => prop.name === 'userIdExpression',
	);

	if (hasUserIdSource || hasUserIdExpression) {
		return description;
	}

	// Clone the description to avoid modifying the original
	const enhancedDescription = { ...description };

	// Ensure properties array exists
	if (!enhancedDescription.properties) {
		enhancedDescription.properties = [];
	}

	// Add the multi-user configuration to the beginning of the properties array
	enhancedDescription.properties = [
		...UNIVERSAL_USER_ID_PROPERTIES.map((prop) => ({ ...prop })), // Clone properties to avoid reference issues
		...enhancedDescription.properties,
	];

	return enhancedDescription;
}

/**
 * Extract user ID from trigger data using dot notation path (legacy support)
 */
export function extractUserIdFromTriggerData(data: any, fieldPath: string): string | undefined {
	if (!data || !fieldPath) return undefined;

	try {
		const keys = fieldPath.split('.');
		let current = data;

		for (const key of keys) {
			if (current === null || current === undefined) return undefined;
			current = current[key];
		}

		return current ? String(current) : undefined;
	} catch (error) {
		return undefined;
	}
}

/**
 * Simple and efficient user ID extraction for trigger nodes
 * Works without requiring n8n's expression engine
 */
export function extractUserIdFromTriggerNode(node: any, data: any): string | undefined {
	try {
		console.log(`extractUserIdFromTriggerNode: Node "${node.name}" (${node.type})`);
		console.log(
			`extractUserIdFromTriggerNode: Node parameters:`,
			JSON.stringify(node.parameters, null, 2),
		);
		console.log(`extractUserIdFromTriggerNode: Data:`, JSON.stringify(data, null, 2));

		// Check for new simplified configuration
		const userIdSource = node.parameters?.userIdSource as string;
		console.log(`extractUserIdFromTriggerNode: userIdSource = "${userIdSource}"`);

		switch (userIdSource) {
			case 'extract':
				const fieldPath = node.parameters?.userIdFieldPath as string;
				console.log(`extractUserIdFromTriggerNode: extract mode, fieldPath = "${fieldPath}"`);
				if (fieldPath) {
					const result = extractUserIdFromTriggerData(data, fieldPath);
					console.log(`extractUserIdFromTriggerNode: extracted result = "${result}"`);
					return result;
				}
				break;

			case 'direct':
				const directValue = node.parameters?.userIdValue as string;
				console.log(`extractUserIdFromTriggerNode: direct mode, directValue = "${directValue}"`);
				if (directValue) {
					console.log(`extractUserIdFromTriggerNode: returning direct value = "${directValue}"`);
					return String(directValue);
				}
				break;

			case 'disabled':
			default:
				console.log(`extractUserIdFromTriggerNode: disabled/default mode, checking legacy configs`);
				// Fall back to legacy configurations for backward compatibility
				const userIdExpression = node.parameters?.userIdExpression as string;
				if (userIdExpression) {
					console.log(
						`extractUserIdFromTriggerNode: found userIdExpression = "${userIdExpression}"`,
					);
					// Handle simple {{ $json.field }} expressions without full expression engine
					const fieldMatch = userIdExpression.match(/^\{\{\s*\$json\.(.+?)\s*\}\}$/);
					if (fieldMatch) {
						const result = extractUserIdFromTriggerData(data, fieldMatch[1]);
						console.log(`extractUserIdFromTriggerNode: expression result = "${result}"`);
						return result;
					}
				}

				const userIdField = node.parameters?.userIdField as string;
				if (userIdField) {
					console.log(`extractUserIdFromTriggerNode: found userIdField = "${userIdField}"`);
					const result = extractUserIdFromTriggerData(data, userIdField);
					console.log(`extractUserIdFromTriggerNode: field result = "${result}"`);
					return result;
				}

				console.log(`extractUserIdFromTriggerNode: no legacy configs found`);
				return undefined;
		}

		console.log(`extractUserIdFromTriggerNode: no result, returning undefined`);
		return undefined;
	} catch (error) {
		console.log(`extractUserIdFromTriggerNode: error occurred:`, error);
		return undefined;
	}
}
