import type {
	ITriggerFunctions,
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class ManualTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Manual Trigger',
		name: 'manualTrigger',
		icon: 'fa:mouse-pointer',
		group: ['trigger'],
		version: 1,
		description: 'Runs the flow on clicking a button in n8n',
		eventTriggerDescription: '',
		maxNodes: 1,
		defaults: {
			name: 'When clicking ‘Execute workflow’',
			color: '#909298',
		},

		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName:
					'This node is where the workflow execution starts (when you click the ‘test’ button on the canvas).<br><br> <a data-action="showNodeCreator">Explore other ways to trigger your workflow</a> (e.g on a schedule, or a webhook)',
				name: 'notice',
				type: 'notice',
				default: '',
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const manualTriggerFunction = async () => {
			// Check if user ID is configured for multi-user workflows
			let triggerData: any = {};

			// Check new configuration first
			const userIdSource = this.getNodeParameter('userIdSource', 'disabled') as string;
			if (userIdSource === 'direct' || userIdSource === 'extract') {
				// For manual triggers, both 'direct' and 'extract' use the userIdValue since there's no incoming data
				const userIdValue = this.getNodeParameter('userIdValue', '') as string;
				if (userIdValue) {
					triggerData.userId = userIdValue;
				}
			} else {
				// Check legacy configurations for backward compatibility
				const userIdField = this.getNodeParameter('userIdField', '') as string;
				const userIdExpression = this.getNodeParameter('userIdExpression', '') as string;

				if (userIdField) {
					// For manual triggers, treat userIdField as a direct value
					triggerData.userId = userIdField;
				} else if (userIdExpression) {
					// Extract simple values from expressions like {{ $json.userId }} -> userId
					const fieldMatch = userIdExpression.match(/^\{\{\s*\$json\.(.+?)\s*\}\}$/);
					if (fieldMatch) {
						triggerData.userId = fieldMatch[1]; // Use the field name as the value
					}
				}
			}

			this.emit([this.helpers.returnJsonArray([triggerData])]);
		};

		return {
			manualTriggerFunction,
		};
	}
}
