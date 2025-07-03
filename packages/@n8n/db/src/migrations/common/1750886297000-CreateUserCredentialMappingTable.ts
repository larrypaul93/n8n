import type { MigrationContext, ReversibleMigration } from '../migration-types';

export class CreateUserCredentialMappingTable1750886297000 implements ReversibleMigration {
	async up({ schemaBuilder: { createTable, column } }: MigrationContext) {
		await createTable('user_credential_mapping')
			.withColumns(
				column('id').varchar(36).primary.notNull,
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

	async down({ schemaBuilder: { dropTable } }: MigrationContext) {
		await dropTable('user_credential_mapping');
	}
}
