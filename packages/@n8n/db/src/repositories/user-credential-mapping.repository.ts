import { Service } from '@n8n/di';
import { DataSource, Repository } from '@n8n/typeorm';

import { UserCredentialMapping } from '../entities/user-credential-mapping';

@Service()
export class UserCredentialMappingRepository extends Repository<UserCredentialMapping> {
	constructor(dataSource: DataSource) {
		super(UserCredentialMapping, dataSource.manager);
	}

	/**
	 * Find the encrypted credential data for a given custom user ID and template credential ID
	 */
	async findUserCredentialData(
		customUserId: string,
		templateCredentialId: string,
	): Promise<string | null> {
		const mapping = await this.findOne({
			where: {
				customUserId,
				templateCredentialId,
				isActive: true,
			},
			select: ['encryptedData'],
		});

		return mapping?.encryptedData || null;
	}

	/**
	 * Find the complete mapping for a given custom user ID and template credential ID
	 */
	async findUserCredentialMapping(
		customUserId: string,
		templateCredentialId: string,
	): Promise<UserCredentialMapping | null> {
		return await this.findOne({
			where: {
				customUserId,
				templateCredentialId,
				isActive: true,
			},
			relations: ['templateCredential'],
		});
	}

	/**
	 * Find all mappings for a given custom user ID
	 */
	async findByCustomUserId(customUserId: string): Promise<UserCredentialMapping[]> {
		return await this.find({
			where: {
				customUserId,
				isActive: true,
			},
			relations: ['templateCredential'],
			order: {
				createdAt: 'DESC',
			},
		});
	}

	/**
	 * Find all mappings for a given template credential ID
	 */
	async findByTemplateCredentialId(templateCredentialId: string): Promise<UserCredentialMapping[]> {
		return await this.find({
			where: {
				templateCredentialId,
				isActive: true,
			},
			relations: ['templateCredential'],
			order: {
				createdAt: 'DESC',
			},
		});
	}

	/**
	 * Create or update a mapping between custom user ID and encrypted credential data
	 */
	async createOrUpdateMapping(
		customUserId: string,
		templateCredentialId: string,
		encryptedData: string,
		additionalData?: Record<string, any>,
		description?: string,
	): Promise<UserCredentialMapping> {
		// Check if mapping already exists
		const existingMapping = await this.findOne({
			where: {
				customUserId,
				templateCredentialId,
			},
		});

		if (existingMapping) {
			// Update existing mapping
			existingMapping.encryptedData = encryptedData;
			existingMapping.additionalData = additionalData;
			existingMapping.description = description;
			existingMapping.isActive = true;
			existingMapping.updatedAt = new Date();

			return await this.save(existingMapping);
		} else {
			// Create new mapping
			const newMapping = this.create({
				customUserId,
				templateCredentialId,
				encryptedData,
				additionalData,
				description,
				isActive: true,
			});

			return await this.save(newMapping);
		}
	}

	/**
	 * Deactivate a mapping (soft delete)
	 */
	async deactivateMapping(customUserId: string, templateCredentialId: string): Promise<boolean> {
		const result = await this.update(
			{
				customUserId,
				templateCredentialId,
			},
			{
				isActive: false,
				updatedAt: new Date(),
			},
		);

		return (result.affected ?? 0) > 0;
	}

	/**
	 * Delete a mapping permanently
	 */
	async deleteMapping(customUserId: string, templateCredentialId: string): Promise<boolean> {
		const result = await this.delete({
			customUserId,
			templateCredentialId,
		});

		return (result.affected ?? 0) > 0;
	}

	/**
	 * Get mapping statistics for a template credential
	 */
	async getMappingStats(templateCredentialId: string): Promise<{
		totalMappings: number;
		activeMappings: number;
		uniqueUsers: number;
	}> {
		const [totalMappings, activeMappings, uniqueUsersResult] = await Promise.all([
			this.count({ where: { templateCredentialId } }),
			this.count({ where: { templateCredentialId, isActive: true } }),
			this.createQueryBuilder('mapping')
				.select('COUNT(DISTINCT mapping.customUserId)', 'count')
				.where('mapping.templateCredentialId = :templateCredentialId', { templateCredentialId })
				.andWhere('mapping.isActive = :isActive', { isActive: true })
				.getRawOne(),
		]);

		return {
			totalMappings,
			activeMappings,
			uniqueUsers: parseInt(uniqueUsersResult?.count || '0', 10),
		};
	}
}
