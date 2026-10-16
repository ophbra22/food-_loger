const {withAndroidManifest}=require('expo/config-plugins');
const permissions=['READ_WEIGHT','READ_STEPS','WRITE_NUTRITION','WRITE_HYDRATION'].map(x=>'android.permission.health.'+x);
const activity='expo.modules.biteflowhealth.HealthPrivacyActivity';
function configureHealthConnect(manifest,enabled){
 const app=manifest.application[0];
 // Optional SDK requires API26, while Health Connect itself needs API28. Preserve
 // ordinary app support at API24; the native module gates ALL SDK entry at API28.
 manifest.$??={};manifest.$['xmlns:tools']='http://schemas.android.com/tools';
 manifest['uses-sdk']??=[{$:{}}];
 const sdk=manifest['uses-sdk'][0].$;
 const overrides=new Set((sdk['tools:overrideLibrary']??'').split(',').filter(Boolean));
 overrides.add('androidx.health.connect.client');sdk['tools:overrideLibrary']=[...overrides].join(',');
 manifest['uses-permission']=(manifest['uses-permission']??[]).filter(x=>!permissions.includes(x.$['android:name']));
 app['meta-data']=(app['meta-data']??[]).filter(x=>x.$['android:name']!=='BiteFlowHealthConnectEnabled');
 app['meta-data'].push({$:{'android:name':'BiteFlowHealthConnectEnabled','android:value':String(enabled)}});
 app.activity=(app.activity??[]).filter(x=>x.$['android:name']!==activity);
 app['activity-alias']=(app['activity-alias']??[]).filter(x=>x.$['android:name']!=='BiteFlowHealthPermissionUsage');
 if(enabled){
  manifest['uses-permission'].push(...permissions.map(p=>({$:{'android:name':p}})));
  manifest.queries??=[];
  if(!manifest.queries.some(q=>q.package?.some(p=>p.$['android:name']==='com.google.android.apps.healthdata')))
   manifest.queries.push({package:[{$:{'android:name':'com.google.android.apps.healthdata'}}]});
  app.activity.push({$:{'android:name':activity,'android:exported':'true'},'intent-filter':[{action:[{$:{'android:name':'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'}}]}]});
  app['activity-alias'].push({$:{'android:name':'BiteFlowHealthPermissionUsage','android:exported':'true','android:targetActivity':activity,'android:permission':'android.permission.START_VIEW_PERMISSION_USAGE'},'intent-filter':[{action:[{$:{'android:name':'android.intent.action.VIEW_PERMISSION_USAGE'}}],category:[{$:{'android:name':'android.intent.category.HEALTH_PERMISSIONS'}}]}]});
 }
 return manifest;
}
module.exports=(config,{enabled=false}={})=>withAndroidManifest(config,c=>{c.modResults.manifest=configureHealthConnect(c.modResults.manifest,enabled);return c;});
module.exports.configureHealthConnect=configureHealthConnect;
