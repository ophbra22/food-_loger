const fs=require('fs');const path=require('path');const plist=require('@expo/plist').default;
const {withAndroidManifest,withInfoPlist,withEntitlementsPlist,withXcodeProject,withDangerousMod}=require('expo/config-plugins');
const GROUP='group.io.github.ophbra22.foodlogger.widgets',TARGET='BiteflowWidgets';
function configureAndroid(manifest,enabled){const a=manifest.manifest.application[0];a['meta-data']=(a['meta-data']||[]).filter(x=>x.$['android:name']!=='BiteFlowWidgetsEnabled');a['meta-data'].push({$:{'android:name':'BiteFlowWidgetsEnabled','android:value':String(enabled)}});a.receiver=(a.receiver||[]).filter(x=>x.$['android:name']!=='expo.modules.biteflowwidgets.BiteflowWidget');a.receiver.push({$:{'android:name':'expo.modules.biteflowwidgets.BiteflowWidget','android:exported':'false','android:enabled':String(enabled),'android:label':'BiteFlow'},'intent-filter':[{action:[{$:{'android:name':'android.appwidget.action.APPWIDGET_UPDATE'}},{$:{'android:name':'android.intent.action.TIME_SET'}},{$:{'android:name':'android.intent.action.TIMEZONE_CHANGED'}},{$:{'android:name':'android.intent.action.LOCALE_CHANGED'}}]}],'meta-data':[{$:{'android:name':'android.appwidget.provider','android:resource':'@xml/biteflow_widget_info'}}]});return manifest;}
const widgetEntitlements=()=>({'com.apple.security.application-groups':[GROUP],'com.apple.developer.default-data-protection':'NSFileProtectionComplete'});
function configureTarget(p){
 let target=Object.entries(p.pbxNativeTargetSection()).find(([,v])=>typeof v==='object'&&String(v.name).replaceAll('"','')===TARGET);
 if(!target){
  const added=p.addTarget(TARGET,'app_extension',TARGET,'io.github.ophbra22.foodlogger.'+TARGET);target=[added.uuid,added.pbxNativeTarget];
  p.addBuildPhase([TARGET+'/BiteflowWidget.swift',TARGET+'/WidgetPolicy.swift',TARGET+'/WidgetFile.swift'],'PBXSourcesBuildPhase','Sources',added.uuid);
  p.addBuildPhase([],'PBXFrameworksBuildPhase','Frameworks',added.uuid);
 }
 const list=p.pbxXCConfigurationList()[target[1].buildConfigurationList];
 for(const ref of list.buildConfigurations){const s=p.pbxXCBuildConfigurationSection()[ref.value].buildSettings;Object.assign(s,{PRODUCT_NAME:'"'+TARGET+'"',PRODUCT_BUNDLE_IDENTIFIER:'"io.github.ophbra22.foodlogger.'+TARGET+'"',INFOPLIST_FILE:TARGET+'/Info.plist',CODE_SIGN_ENTITLEMENTS:TARGET+'/'+TARGET+'.entitlements',PRODUCT_MODULE_NAME:'BiteflowWidgetExtension',SWIFT_VERSION:'5.0',IPHONEOS_DEPLOYMENT_TARGET:'16.4',TARGETED_DEVICE_FAMILY:'"1,2"',APPLICATION_EXTENSION_API_ONLY:'YES',SKIP_INSTALL:'YES',GENERATE_INFOPLIST_FILE:'NO',CURRENT_PROJECT_VERSION:'1',MARKETING_VERSION:'1.0.0',SWIFT_EMIT_LOC_STRINGS:'YES',CLANG_ENABLE_MODULES:'YES'});}
 return p;
}
module.exports=(config,{enabled=false}={})=>{
 config=withAndroidManifest(config,c=>{configureAndroid(c.modResults,enabled);return c;});
 config=withInfoPlist(config,c=>{Object.assign(c.modResults,{BiteFlowWidgetsEnabled:enabled,BiteFlowWidgetsGroup:GROUP});return c;});
 config=withEntitlementsPlist(config,c=>{const groups=c.modResults['com.apple.security.application-groups']||[];c.modResults['com.apple.security.application-groups']=[...new Set([...groups,GROUP])];return c;});
 config=withDangerousMod(config,['ios',async c=>{
  const root=c.modRequest.projectRoot,dest=path.join(c.modRequest.platformProjectRoot,TARGET);fs.mkdirSync(dest,{recursive:true});
  fs.copyFileSync(path.join(root,'widgets/ios/BiteflowWidget.swift'),path.join(dest,'BiteflowWidget.swift'));
  for(const f of ['WidgetPolicy.swift','WidgetFile.swift'])fs.copyFileSync(path.join(root,'modules/biteflow-widgets/ios',f),path.join(dest,f));
  fs.writeFileSync(path.join(dest,'Info.plist'),plist.build({CFBundleDisplayName:'BiteFlow',CFBundleIdentifier:'$(PRODUCT_BUNDLE_IDENTIFIER)',CFBundleExecutable:'$(EXECUTABLE_NAME)',CFBundlePackageType:'XPC!',CFBundleShortVersionString:'1.0.0',CFBundleVersion:'1',NSExtension:{NSExtensionPointIdentifier:'com.apple.widgetkit-extension'},BiteFlowWidgetsGroup:GROUP,BiteFlowWidgetsEnabled:enabled}));
  fs.writeFileSync(path.join(dest,TARGET+'.entitlements'),plist.build(widgetEntitlements()));return c;
 }]);
 return withXcodeProject(config,c=>{configureTarget(c.modResults);return c;});
};
Object.assign(module.exports,{configureAndroid,widgetEntitlements,configureTarget});
