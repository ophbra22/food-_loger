/** @jest-environment node */
const {configureLint, configureCamera, qualifySplash} = require('../with-android-compatibility.cjs');

test('K1 analysis is idempotent and preserves unrelated Gradle settings', () => {
  const properties = [{type:'comment', value:'keep'}, {type:'property', key:'other', value:'1'},
    {type:'property', key:'android.lint.useK2Uast', value:'true'}];
  configureLint(properties); configureLint(properties);
  expect(properties).toEqual([{type:'comment',value:'keep'}, {type:'property',key:'other',value:'1'},
    {type:'property',key:'android.lint.useK2Uast',value:'false'}]);
});

test('camera hardware is optional while permission and other features stay intact', () => {
  const manifest = {manifest:{'uses-permission':[{$:{'android:name':'android.permission.CAMERA'}}],
    'uses-feature':[{$:{'android:name':'android.hardware.camera','android:required':'true'}},
      {$:{'android:name':'android.hardware.microphone','android:required':'false'}}]}};
  configureCamera(manifest); configureCamera(manifest);
  expect(manifest.manifest['uses-feature']).toHaveLength(2);
  expect(manifest.manifest['uses-feature'][0].$['android:required']).toBe('false');
  expect(manifest.manifest['uses-feature'][1].$['android:name']).toBe('android.hardware.microphone');
  expect(manifest.manifest['uses-permission'][0].$['android:name']).toBe('android.permission.CAMERA');
});

const item = (name, value) => ({$: {name}, _: value});
function styles() {
  return {resources:{$:{'xmlns:tools':'http://schemas.android.com/tools'}, style:[
    {$:{name:'AppTheme',parent:'Base'},item:[item('colorPrimary','green')]},
    {$:{name:'Theme.App.SplashScreen',parent:'Theme.SplashScreen'},item:[
      item('windowSplashScreenBackground','@color/splashscreen_background'),
      item('windowSplashScreenAnimatedIcon','@drawable/splashscreen_logo'),
      item('postSplashScreenTheme','@style/AppTheme'),
      item('android:windowSplashScreenBehavior','icon_preferred')]}]}};
}

test('API 33 attribute moves to qualified resources with the complete splash theme', () => {
  const base = styles(); const qualified = {resources:{string:[item('untouched','yes')]}};
  qualifySplash(base, qualified);
  expect(base.resources.style[0]).toEqual(styles().resources.style[0]);
  expect(base.resources.style[1].item).toEqual(styles().resources.style[1].item.slice(0,3));
  expect(qualified.resources.style[0]).toEqual(styles().resources.style[1]);
  expect(qualified.resources.string).toEqual([item('untouched','yes')]);
  const once = JSON.stringify({base, qualified});
  qualifySplash(base, qualified);
  expect(JSON.stringify({base, qualified})).toBe(once);
});

test('regeneration updates base splash values and preserves additional qualified entries', () => {
  const base=styles(); const qualified={resources:{style:[
    {$:{name:'Other'},item:[item('other','keep')]},
    {$:{name:'Theme.App.SplashScreen'},item:[item('custom','keep'),item('postSplashScreenTheme','stale')]}]}};
  qualifySplash(base,qualified);
  const splash=qualified.resources.style.find(s=>s.$.name==='Theme.App.SplashScreen');
  expect(splash.item).toContainEqual(item('postSplashScreenTheme','@style/AppTheme'));
  expect(splash.item).toContainEqual(item('custom','keep'));
  expect(qualified.resources.style.find(s=>s.$.name==='Other').item).toEqual([item('other','keep')]);
});

test('projects without the SDK 57 splash attribute need no qualified theme', () => {
  const base={resources:{style:[]}}; const qualified={resources:{}};
  qualifySplash(base,qualified);
  expect(qualified).toEqual({resources:{}});
});
