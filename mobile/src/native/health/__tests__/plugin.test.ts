/** @jest-environment node */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {configureHealth}=require('../../../../plugins/with-health.cjs');
test('disabled Health config removes only owned entitlement and enabled asks minimum access',()=>{
 const off=configureHealth({other:true,'com.apple.developer.healthkit':true},{Other:'keep'},false);
 expect(off.entitlements).toEqual({other:true});expect(off.info.BiteFlowHealthEnabled).toBe(false);
 const on=configureHealth({}, {},true);expect(on.entitlements).toEqual({'com.apple.developer.healthkit':true});expect(on.info.NSHealthShareUsageDescription).toContain('weight');expect(on.info.NSHealthUpdateUsageDescription).toContain('water');
});
