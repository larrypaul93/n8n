import { Service } from '@n8n/di';
import { ApplicationError } from 'n8n-workflow';
import type {
	Workflow,
	INode,
	INodeExecutionData,
	IPollFunctions,
	IWorkflowExecuteAdditionalData,
	WorkflowExecuteMode,
	WorkflowActivateMode,
	ITriggerResponse,
	IDeferredPromise,
	IExecuteResponsePromiseData,
	IRun,
} from 'n8n-workflow';

import { extractUserIdFromTriggerNode } from './universal-trigger-properties';
import assert from 'node:assert';

import type { IGetExecuteTriggerFunctions } from './interfaces';
import { extractUserIdFromTriggerData } from './universal-trigger-properties';

@Service()
export class TriggersAndPollers {
	/**
	 * Runs the given trigger node so that it can trigger the workflow when the node has data.
	 */
	async runTrigger(
		workflow: Workflow,
		node: INode,
		getTriggerFunctions: IGetExecuteTriggerFunctions,
		additionalData: IWorkflowExecuteAdditionalData,
		mode: WorkflowExecuteMode,
		activation: WorkflowActivateMode,
	): Promise<ITriggerResponse | undefined> {
		const triggerFunctions = getTriggerFunctions(workflow, node, additionalData, mode, activation);

		const nodeType = workflow.nodeTypes.getByNameAndVersion(node.type, node.typeVersion);

		if (!nodeType.trigger) {
			throw new ApplicationError('Node type does not have a trigger function defined', {
				extra: { nodeName: node.name },
				tags: { nodeType: node.type },
			});
		}

		if (mode === 'manual') {
			// In manual mode we do not just start the trigger function we also
			// want to be able to get informed as soon as the first data got emitted
			const triggerResponse = await nodeType.trigger.call(triggerFunctions);

			// Add the manual trigger response which resolves when the first time data got emitted
			triggerResponse!.manualTriggerResponse = new Promise((resolve, reject) => {
				const { hooks } = additionalData;
				assert.ok(hooks, 'Execution lifecycle hooks are not defined');

				triggerFunctions.emit = (
					data: INodeExecutionData[][],
					responsePromise?: IDeferredPromise<IExecuteResponsePromiseData>,
					donePromise?: IDeferredPromise<IRun>,
				) => {
					// Universal user ID extraction for ALL trigger nodes
					this.extractAndSetUserId(node, data, additionalData);

					if (responsePromise) {
						hooks.addHandler('sendResponse', (response) => responsePromise.resolve(response));
					}

					if (donePromise) {
						hooks.addHandler('workflowExecuteAfter', (runData) => donePromise.resolve(runData));
					}

					resolve(data);
				};

				triggerFunctions.emitError = (
					error: Error,
					responsePromise?: IDeferredPromise<IExecuteResponsePromiseData>,
				) => {
					if (responsePromise) {
						hooks.addHandler('sendResponse', () => responsePromise.reject(error));
					}
					reject(error);
				};
			});

			return triggerResponse;
		}
		// In all other modes, wrap the emit function to extract user ID
		const originalEmit = triggerFunctions.emit;
		triggerFunctions.emit = (
			data: INodeExecutionData[][],
			responsePromise?: IDeferredPromise<IExecuteResponsePromiseData>,
			donePromise?: IDeferredPromise<IRun>,
		) => {
			// Universal user ID extraction for ALL trigger nodes
			this.extractAndSetUserId(node, data, additionalData);
			return originalEmit(data, responsePromise, donePromise);
		};

		// In all other modes simply start the trigger
		return await nodeType.trigger.call(triggerFunctions);
	}

	/**
	 * Universal method to extract user ID from trigger data and set it in additional data
	 * This works for ALL trigger nodes without any modifications to individual nodes
	 */
	private extractAndSetUserId(
		node: INode,
		data: INodeExecutionData[][],
		additionalData: IWorkflowExecuteAdditionalData,
	): void {
		try {
			// Get the first item from the first output
			const firstItem = data[0]?.[0];
			if (!firstItem?.json) return;

			// Use the simplified extraction function that works without expression engine
			const extractedUserId = extractUserIdFromTriggerNode(node, firstItem.json);

			if (extractedUserId) {
				// Set the user ID in the additional data for credential resolution
				additionalData.userId = extractedUserId;
			}
		} catch (error) {
			// Silently fail if extraction fails - don't break the workflow
			// This ensures backward compatibility
		}
	}

	/**
	 * Runs the given poller node so that it can trigger the workflow when the node has data.
	 */
	async runPoll(
		workflow: Workflow,
		node: INode,
		pollFunctions: IPollFunctions,
	): Promise<INodeExecutionData[][] | null> {
		const nodeType = workflow.nodeTypes.getByNameAndVersion(node.type, node.typeVersion);

		if (!nodeType.poll) {
			throw new ApplicationError('Node type does not have a poll function defined', {
				extra: { nodeName: node.name },
				tags: { nodeType: node.type },
			});
		}

		return await nodeType.poll.call(pollFunctions);
	}
}
