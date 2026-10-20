/** @jest-environment node */
const { validateTestflightEnvironment } = require('../testflight-config.cjs');
test.each(['', 'http://staging.onrender.com', 'https://foodlogger-yfn4.onrender.com', 'https://FOODLOGGER-YFN4.ONRENDER.COM./', 'https://user:pass@staging.onrender.com', 'https://staging.onrender.com/api', 'https://staging.onrender.com?key=value'])('beta packaging refuses an unsafe API origin: %s', url => {
 expect(() => validateTestflightEnvironment({ EXPO_PUBLIC_STAGING_BUILD: '1', EXPO_PUBLIC_API_URL: url })).toThrow();
});
test('a dedicated HTTPS staging origin is accepted without enabling overrides', () => {
 expect(() => validateTestflightEnvironment({ EXPO_PUBLIC_STAGING_BUILD: '1', EXPO_PUBLIC_API_URL: 'https://biteflow-staging.onrender.com' })).not.toThrow();
 expect(() => validateTestflightEnvironment({ EXPO_PUBLIC_STAGING_BUILD: '1', EXPO_PUBLIC_API_URL: 'https://biteflow-staging.onrender.com', EXPO_PUBLIC_ALLOW_SERVER_OVERRIDE:'1' })).toThrow();
});
test('ordinary development and existing production configuration keep their contract', () => {
 expect(() => validateTestflightEnvironment({ EXPO_PUBLIC_API_URL:'http://localhost:8000', EXPO_PUBLIC_ALLOW_SERVER_OVERRIDE:'1' })).not.toThrow();
});
