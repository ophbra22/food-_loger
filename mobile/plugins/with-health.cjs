const {withEntitlementsPlist,withInfoPlist}=require('expo/config-plugins');
function configureHealth(entitlements,info,enabled){
 const next={...entitlements};delete next['com.apple.developer.healthkit'];
 if(enabled)next['com.apple.developer.healthkit']=true;
 return {entitlements:next,info:{...info,BiteFlowHealthEnabled:enabled,...(enabled?{NSHealthShareUsageDescription:'BiteFlow reads only the weight and step data you choose to import into your private journal.',NSHealthUpdateUsageDescription:'BiteFlow writes your confirmed nutrition and water entries only when you enable sync.'}:{})}};
}
module.exports=(config,{enabled=false}={})=>{
 config=withEntitlementsPlist(config,c=>{c.modResults=configureHealth(c.modResults,{},enabled).entitlements;return c;});
 return withInfoPlist(config,c=>{c.modResults=configureHealth({},c.modResults,enabled).info;return c;});
};
module.exports.configureHealth=configureHealth;
