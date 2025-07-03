import type { MigrationContext, ReversibleMigration } from '../migration-types';

export class RecreateUserCredentialMappingTable1750886298000 implements ReversibleMigration {
	async up({ schemaBuilder: { createTable, column }, queryRunner, tablePrefix }: MigrationContext) {
		// Drop the existing table if it exists (it may have incorrect schema)
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}user_credential_mapping`);

		// Recreate the table with the correct schema
		await createTable('user_credential_mapping')
			.withColumns(
				column('id').uuid.primary.notNull.autoGenerate2,
				column('customUserId').varchar(255).notNull,
				column('templateCredentialId').varchar(36).notNull,
				column('encryptedData').text.notNull,
				column('additionalData').text,
				column('description').text,
				column('isActive').bool.notNull.default(true),
			)
			.withIndexOn(['customUserId', 'templateCredentialId'], true) // unique index
			.withIndexOn('templateCredentialId') // index for faster lookups
			.withIndexOn('customUserId') // index for user-based queries
			.withForeignKey('templateCredentialId', {
				tableName: 'credentials_entity',
				columnName: 'id',
				onDelete: 'CASCADE',
			}).withTimestamps;
	}

	async down({ queryRunner, tablePrefix }: MigrationContext) {
		// Drop the table
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}user_credential_mapping`);
	}
}
