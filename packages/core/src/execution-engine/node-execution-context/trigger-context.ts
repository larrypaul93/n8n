import type {
	ICredentialDataDecryptedObject,
	INode,
	ITriggerFunctions,
	IWorkflowExecuteAdditionalData,
	Workflow,
	WorkflowActivateMode,
	WorkflowExecuteMode,
	INodeExecutionData,
} from 'n8n-workflow';
import { ApplicationError, createDeferredPromise } from 'n8n-workflow';

import { NodeExecutionContext } from './node-execution-context';
import { getBinaryHelperFunctions } from './utils/binary-helper-functions';
import { getRequestHelperFunctions } from './utils/request-helper-functions';
import { returnJsonArray } from './utils/return-json-array';
import { getSchedulingFunctions } from './utils/scheduling-helper-functions';
import { getSSHTunnelFunctions } from './utils/ssh-tunnel-helper-functions';

const throwOnEmit = () => {
	throw new ApplicationError('Overwrite TriggerContext.emit function');
};

const throwOnEmitError = () => {
	throw new ApplicationError('Overwrite TriggerContext.emitError function');
};

export class TriggerContext extends NodeExecutionContext implements ITriggerFunctions {
	readonly helpers: ITriggerFunctions['helpers'];

	constructor(
		workflow: Workflow,
		node: INode,
		additionalData: IWorkflowExecuteAdditionalData,
		mode: WorkflowExecuteMode,
		private readonly activation: WorkflowActivateMode,
		readonly emit: ITriggerFunctions['emit'] = throwOnEmit,
		readonly emitError: ITriggerFunctions['emitError'] = throwOnEmitError,
	) {
		super(workflow, node, additionalData, mode);

		this.helpers = {
			createDeferredPromise,
			returnJsonArray,
			...getSSHTunnelFunctions(),
			...getRequestHelperFunctions(workflow, node, additionalData),
			...getBinaryHelperFunctions(additionalData, workflow.id),
			...getSchedulingFunctions(workflow),
		};
	}

	/**
	 * Extract user ID from trigger data based on node configuration
	 */
	private extractUserIdFromData(data: INodeExecutionData[][]): string | undefined {
		try {
			// Check if user ID extraction is configured
			const userIdField = this.getNodeParameter('userIdField', '') as string;
			if (!userIdField) return undefined;

			// Get the first item from the first output
			const firstItem = data[0]?.[0];
			if (!firstItem?.json) return undefined;

			// Extract user ID using dot notation
			return this.getValueByPath(firstItem.json, userIdField);
		} catch (error) {
			// Silently fail if extraction fails
			return undefined;
		}
	}

	/**
	 * Get value from object using dot notation path
	 */
	private getValueByPath(obj: any, path: string): string | undefined {
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

	getActivationMode() {
		return this.activation;
	}

	async getCredentials<T extends object = ICredentialDataDecryptedObject>(type: string) {
		return await this._getCredentials<T>(type);
	}
}
