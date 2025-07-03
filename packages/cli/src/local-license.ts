import type { TFeatures } from '@n8n_io/license-sdk';
import { LicenseManager, TLicenseManagerConfig, TLogger } from '@n8n_io/license-sdk';

const customFeatures: TFeatures = {
	'feat:sharing': true,
	'feat:ldap': true,
	'feat:saml': true,
	'feat:oidc': true,
	'feat:logStreaming': true,
	'feat:variables': true,
	'feat:sourceControl': true,

	// "feat: apiDisabled":true,
	'feat:externalSecrets': true,
	'feat:workflowHistory': true,
	'feat:debugInEditor': true,
	'feat:binaryDataS3': true,
	'feat:multipleMainInstances': true,
	'feat:workerView': true,
	'feat:advancedPermissions': true,
	'feat:projectRole:admin': true,
	'feat:projectRole:editor': true,
	'feat:projectRole:viewer': true,
	'feat:aiAssistant': true,
	'feat:askAi': true,
	'feat:communityNodes:customRegistry': true,
	// "feat: aiCredits":true,
	'feat:insights:viewDashboard': true,
	'feat:insights:viewHourlyData': true,
	'feat:apiKeyScopes': true,
	'feat:advancedExecutionFilters': true,
	'quota:maxTeamProjects': -1,
};
export class LocalLicenseManager extends LicenseManager {
	private _logger: TLogger;
	constructor(options: TLicenseManagerConfig) {
		super(options);
		if (options.logger) {
			this._logger = options.logger;
		} else {
			this._logger = {
				error() {
					console.log('ERROR:', ...arguments);
				},
				warn() {
					console.log('WARN:', ...arguments);
				},
				info() {
					console.log('INFO:', ...arguments);
				},
				debug() {
					console.log('DEBUG:', ...arguments);
				},
			};
		}
	}

	getFeatures() {
		// this._logger.info('Getting license features', super.getFeatures());

		let features = super.getFeatures();
		features = { ...features, ...customFeatures };
		// this._logger.info('Patched license features', features);
		return features;
	}
	// getFeatureValue(
	//  feature: string,
	//      requireValidCert: boolean = true
	// ): undefined | boolean | number | string {

	//      let returnValue = super.getFeatureValue(feature, requireValidCert);
	//      let currentFeatures = super.getFeatures();
	//      if (currentFeatures.hasOwnProperty(feature)) {
	//              returnValue = currentFeatures[feature]
	//      }
	//      if(customFeatures.hasOwnProperty(feature)) {
	//              returnValue = customFeatures[feature]
	//      }
	//      for(let key of Object.keys(customFeatures)) {
	//              let matched = key == feature;
	//              if(matched) {
	//                      returnValue = customFeatures[key]
	//              }
	//              this._logger.info('Matching feature', {feature, key, matched, returnValue});
	//      }
	//      this._logger.info('Getting license feature value', {feature, returnValue, res: super.getFeatureValue(feature, requireValidCert)});
	//      return returnValue;
	// }
	// hasFeatureEnabled(feature: string,requireValidCert: boolean = true) {
	//      // this._logger.info('Checking if feature is enabled', {feature, res: super.hasFeatureEnabled(feature, requireValidCert)});
	//      return super.hasFeatureEnabled(feature, requireValidCert);
	// }
	getCurrentEntitlements() {
		// this._logger.info('Getting current entitlements', super.getCurrentEntitlements());
		let entitlements = super.getCurrentEntitlements();
		if (entitlements && entitlements.length > 0 && entitlements[0].features) {
			entitlements[0].features = { ...entitlements[0].features, ...customFeatures };
		}
		this._logger.info('Patched current entitlements', entitlements);
		return entitlements;
	}
}
