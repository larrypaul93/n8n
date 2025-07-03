import type { MigrationContext, ReversibleMigration } from '../migration-types';

export class CreateUserCredentialMappingTable1750886297000 implements ReversibleMigration {
	async up({ queryRunner, tablePrefix }: MigrationContext) {
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}user_credential_mapping (
				id varchar(36) PRIMARY KEY NOT NULL,
				customUserId varchar(255) NOT NULL,
				templateCredentialId varchar(36) NOT NULL,
				encryptedData text NOT NULL,
				additionalData text,
				description text,
				isActive boolean NOT NULL DEFAULT 1,
				createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (templateCredentialId) REFERENCES ${tablePrefix}credentials_entity(id) ON DELETE CASCADE
			)
		`);

		// Create unique index on customUserId and templateCredentialId
		await queryRunner.query(`
			CREATE UNIQUE INDEX IDX_${tablePrefix}user_credential_mapping_custom_template
			ON ${tablePrefix}user_credential_mapping (customUserId, templateCredentialId)
		`);

		// Create index on templateCredentialId for faster lookups
		await queryRunner.query(`
			CREATE INDEX IDX_${tablePrefix}user_credential_mapping_template
			ON ${tablePrefix}user_credential_mapping (templateCredentialId)
		`);

		// Create index on customUserId for faster user-based queries
		await queryRunner.query(`
			CREATE INDEX IDX_${tablePrefix}user_credential_mapping_custom_user
			ON ${tablePrefix}user_credential_mapping (customUserId)
		`);

		// Note: SQLite foreign key constraints are defined in the CREATE TABLE statement
		// The foreign key constraint for templateCredentialId is already included in the table creation
	}

	async down({ queryRunner, tablePrefix }: MigrationContext) {
		await queryRunner.query(`DROP TABLE ${tablePrefix}user_credential_mapping`);
	}
}
