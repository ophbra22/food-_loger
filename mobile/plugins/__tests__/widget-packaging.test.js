/** @jest-environment node */
const xcode = require('xcode');
const path = require('path');
const { configureTarget, widgetInfoPlist, declareExtension } = require('../with-widgets.cjs');

function project() {
 const p = xcode.project(path.resolve(__dirname, 'fixtures/base.pbxproj'));
 p.parseSync();
 return p;
}
test('widget uses the containing app versions after a remote build increment', () => {
 const p = project();
 configureTarget(p, { version: '1.2.3', ios: { buildNumber: '42' } });
 const target = Object.values(p.pbxNativeTargetSection()).find(v => typeof v === 'object' && String(v.name).replaceAll('"', '') === 'BiteflowWidgets');
 for (const ref of p.pbxXCConfigurationList()[target.buildConfigurationList].buildConfigurations) {
  const settings = p.pbxXCBuildConfigurationSection()[ref.value].buildSettings;
  expect(settings.CURRENT_PROJECT_VERSION).toBe('42');
  expect(settings.MARKETING_VERSION).toBe('1.2.3');
 }
 const info = widgetInfoPlist(true);
 expect(info.CFBundleVersion).toBe('$(CURRENT_PROJECT_VERSION)');
 expect(info.CFBundleShortVersionString).toBe('$(MARKETING_VERSION)');
});
test('EAS sees the cleanup extension before prebuild and keeps other extensions', () => {
 const config = { extra: { eas: { projectId: 'existing', build: { experimental: { ios: {
  appExtensions: [{ targetName: 'Other', bundleIdentifier: 'other' }],
 } } } } } };
 declareExtension(config);
 declareExtension(config);
 expect(config.extra.eas.projectId).toBe('existing');
 expect(config.extra.eas.build.experimental.ios.appExtensions).toEqual([
  { targetName: 'Other', bundleIdentifier: 'other' },
  { targetName: 'BiteflowWidgets', bundleIdentifier: 'io.github.ophbra22.foodlogger.BiteflowWidgets',
   entitlements: { 'com.apple.security.application-groups': ['group.io.github.ophbra22.foodlogger.widgets'],
    'com.apple.developer.default-data-protection': 'NSFileProtectionComplete' } },
 ]);
 expect(widgetInfoPlist(false).BiteFlowWidgetsEnabled).toBe(false);
});
