import { NodeTestHarness } from '@nodes-testing/node-test-harness';
import nock from 'nock';

describe('Test N8n Node', () => {
	const baseUrl = 'https://test.app.n8n.cloud/api/v1';
	const credentials = {
		n8nApi: {
			apiKey: 'key123',
			baseUrl,
		},
	};

	beforeAll(async () => {
		const { pinData } = await import('./workflow.n8n.workflows.json');
		const apiResponse = pinData.n8n.map((item) => item.json);
		nock(baseUrl).get('/workflows?tags=n8n-test').reply(200, { data: apiResponse });
	});

	new NodeTestHarness().setupTests({ credentials });

	describe('Multi-User Credential Operations', () => {
		it('should have multi-user credential operations defined', () => {
			const { N8n } = require('../../N8n.node');
			const nodeInstance = new N8n();
			const operations = nodeInstance.description.properties.find(
				(prop: any) =>
					prop.name === 'operation' && prop.displayOptions?.show?.resource?.includes('credential'),
			);

			expect(operations).toBeDefined();
			expect(operations.options).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						name: 'Create Multi User Credential',
						value: 'createMultiUser',
						action: 'Create a multi-user credential',
					}),
					expect.objectContaining({
						name: 'Get OAuth URL for Multi User Credential',
						value: 'getMultiUserOAuthUrl',
						action: 'Get OAuth authorization URL for multi-user credential',
					}),
				]),
			);
		});

		it('should have correct routing for multi-user operations', () => {
			const { N8n } = require('../../N8n.node');
			const nodeInstance = new N8n();
			const operations = nodeInstance.description.properties.find(
				(prop: any) =>
					prop.name === 'operation' && prop.displayOptions?.show?.resource?.includes('credential'),
			);

			const createMultiUserOp = operations.options.find(
				(op: any) => op.value === 'createMultiUser',
			);
			const getMultiUserOp = operations.options.find((op: any) => op.value === 'getMultiUser');
			const getOAuthUrlOp = operations.options.find(
				(op: any) => op.value === 'getMultiUserOAuthUrl',
			);

			expect(createMultiUserOp.routing.request.url).toBe('/credentials/multi-user');
			expect(createMultiUserOp.routing.request.method).toBe('POST');

			expect(getMultiUserOp.routing.request.url).toBe(
				'=/user-credential-mappings/resolve/{{ $parameter.customUserId }}/{{ $parameter.templateCredentialId }}',
			);
			expect(getMultiUserOp.routing.request.method).toBe('GET');

			expect(getOAuthUrlOp.routing.request.url).toBe('/credentials/multi-user/oauth/url');
			expect(getOAuthUrlOp.routing.request.method).toBe('POST');
		});

		it('should have credential search methods registered', () => {
			const { N8n } = require('../../N8n.node');
			const nodeInstance = new N8n();

			expect(nodeInstance.methods.listSearch).toBeDefined();
			expect(nodeInstance.methods.listSearch.searchCredentials).toBeDefined();
			expect(nodeInstance.methods.listSearch.searchOAuthCredentials).toBeDefined();
		});

		it('should have resource locators for template credentials', () => {
			const { N8n } = require('../../N8n.node');
			const nodeInstance = new N8n();

			// Find templateCredentialId fields
			const templateCredFields = nodeInstance.description.properties.filter(
				(prop: any) => prop.name === 'templateCredentialId',
			);

			expect(templateCredFields.length).toBeGreaterThan(0);

			// Check that at least one uses resourceLocator type
			const resourceLocatorFields = templateCredFields.filter(
				(prop: any) => prop.type === 'resourceLocator',
			);

			expect(resourceLocatorFields.length).toBeGreaterThan(0);
		});
	});
});
