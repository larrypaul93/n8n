import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from '@n8n/typeorm';
import { IsString, IsOptional, IsObject } from 'class-validator';

import { WithTimestamps } from './abstract-entity';
import { CredentialsEntity } from './credentials-entity';

/**
 * Entity for mapping custom user IDs to user-specific credential data in multi-user workflows.
 * This allows the same workflow to use different credentials for different users without
 * creating separate credential entities.
 */
@Entity()
@Index(['customUserId', 'templateCredentialId'], { unique: true })
export class UserCredentialMapping extends WithTimestamps {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	/**
	 * Custom user ID from trigger nodes or external systems.
	 * This is not the n8n user ID, but a custom identifier like 'user123', 'customer456', etc.
	 */
	@Column({ length: 255 })
	@IsString()
	customUserId: string;

	/**
	 * The template credential ID that is used in workflow nodes.
	 * This credential should have useUserFilter: true
	 */
	@Column()
	@IsString()
	templateCredentialId: string;

	/**
	 * Encrypted user-specific credential data.
	 * This contains the actual credential values (API keys, tokens, etc.) for this user.
	 * Data is encrypted using the same encryption as CredentialsEntity.
	 */
	@Column({ type: 'text' })
	@IsString()
	encryptedData: string;

	/**
	 * Reference to the template credential entity
	 */
	@ManyToOne(() => CredentialsEntity, { onDelete: 'CASCADE' })
	templateCredential: CredentialsEntity;

	/**
	 * Optional additional metadata for this mapping.
	 * Can store configuration, user preferences, or other relevant information.
	 * This is separate from the credential data itself.
	 */
	@Column({ type: 'json', nullable: true })
	@IsOptional()
	@IsObject()
	additionalData?: Record<string, any>;

	/**
	 * Optional description for this mapping
	 */
	@Column({ type: 'text', nullable: true })
	@IsOptional()
	@IsString()
	description?: string;

	/**
	 * Whether this mapping is active/enabled
	 */
	@Column({ type: 'boolean', default: true })
	isActive: boolean;
}
