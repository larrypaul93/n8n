import { Service } from '@n8n/di';
import { Cipher } from 'n8n-core';
import type { ICredentialDataDecryptedObject } from 'n8n-workflow';

/**
 * Service for handling encryption and decryption of user-specific credential data
 * in multi-user workflows. This ensures user credential data is properly encrypted
 * when stored in the UserCredentialMapping table.
 */
@Service()
export class UserCredentialDataService {
	constructor(private readonly cipher: Cipher) {}

	/**
	 * Encrypt user credential data for storage in the mapping table
	 */
	encryptCredentialData(data: ICredentialDataDecryptedObject): string {
		return this.cipher.encrypt(data);
	}

	/**
	 * Decrypt user credential data from the mapping table
	 */
	decryptCredentialData(encryptedData: string): ICredentialDataDecryptedObject {
		const decryptedString = this.cipher.decrypt(encryptedData);
		try {
			return JSON.parse(decryptedString);
		} catch (error) {
			throw new Error('Failed to parse decrypted credential data');
		}
	}

	/**
	 * Validate that credential data contains required fields for a given credential type
	 */
	validateCredentialData(
		data: ICredentialDataDecryptedObject,
		credentialType: string,
		requiredFields: string[] = [],
	): boolean {
		if (!data || typeof data !== 'object') {
			return false;
		}

		// Check if all required fields are present
		for (const field of requiredFields) {
			if (!(field in data) || data[field] === undefined || data[field] === null) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Sanitize credential data by removing sensitive fields from logs/errors
	 */
	sanitizeCredentialData(data: ICredentialDataDecryptedObject): Record<string, any> {
		const sensitiveFields = [
			'password',
			'token',
			'secret',
			'key',
			'apiKey',
			'accessToken',
			'refreshToken',
			'clientSecret',
			'privateKey',
		];

		const sanitized: Record<string, any> = {};

		for (const [key, value] of Object.entries(data)) {
			const lowerKey = key.toLowerCase();
			const isSensitive = sensitiveFields.some((field) => lowerKey.includes(field));

			if (isSensitive) {
				sanitized[key] = '[REDACTED]';
			} else {
				sanitized[key] = value;
			}
		}

		return sanitized;
	}
}
