const path = require('node:path');
const {AndroidConfig, withAndroidManifest, withAndroidStyles, withGradleProperties} = require('expo/config-plugins');
const {writeXMLAsync} = require('@expo/config-plugins/build/utils/XML');

function configureLint(properties) {
  // AGP 8.12 K2 UAST crashes on Worklets' included Kotlin build script (430991549).
  // Keep all checks/modules enabled; K1 is the supported current-toolchain fallback.
  const key = 'android.lint.useK2Uast';
  const existing = properties.find(p => p.type === 'property' && p.key === key);
  if (existing) existing.value = 'false';
  else properties.push({type:'property', key, value:'false'});
}

function configureCamera(manifest) {
  // Manual entry and photo-library import work on devices without camera hardware.
  const features = manifest.manifest['uses-feature'] ??= [];
  const name = 'android.hardware.camera';
  const feature = features.find(f => f.$['android:name'] === name);
  if (feature) feature.$['android:required'] = 'false';
  else features.push({$:{'android:name':name, 'android:required':'false'}});
}

function qualifySplash(base, qualified) {
  const name = 'Theme.App.SplashScreen';
  const attribute = 'android:windowSplashScreenBehavior';
  const splash = base.resources.style?.find(s => s.$.name === name);
  if (!splash) return;
  const existing = qualified.resources.style?.find(s => s.$.name === name);
  const behavior = splash.item?.find(i => i.$.name === attribute)
    ?? existing?.item?.find(i => i.$.name === attribute);
  if (!behavior) return;
  splash.item = splash.item.filter(i => i.$.name !== attribute);
  // A qualified style must retain the full theme, including postSplashScreenTheme.
  // Preserve unrelated qualified items, but propagate changes from the base theme.
  const items = [...splash.item, behavior];
  const names = new Set(items.map(i => i.$.name));
  const next = JSON.parse(JSON.stringify({...splash,
    item:[...items, ...(existing?.item ?? []).filter(i => !names.has(i.$.name))]}));
  qualified.resources.$ = {...base.resources.$, ...qualified.resources.$};
  qualified.resources.style = [...(qualified.resources.style ?? []).filter(s => s.$.name !== name), next];
}

module.exports = config => {
  config = withGradleProperties(config, mod => {configureLint(mod.modResults); return mod;});
  config = withAndroidManifest(config, mod => {configureCamera(mod.modResults); return mod;});
  return withAndroidStyles(config, async mod => {
    if (mod.modRequest.introspect) return mod;
    const file = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/values-v33/styles.xml');
    const qualified = await AndroidConfig.Resources.readResourcesXMLAsync({path:file});
    qualifySplash(mod.modResults, qualified);
    if (qualified.resources.style?.length) await writeXMLAsync({path:file, xml:qualified});
    return mod;
  });
};
module.exports.configureLint = configureLint;
module.exports.configureCamera = configureCamera;
module.exports.qualifySplash = qualifySplash;
