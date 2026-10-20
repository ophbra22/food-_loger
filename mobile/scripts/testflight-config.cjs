/** Build-time guard; never let a staging beta silently use the production API. */
function validateTestflightEnvironment(env) {
  if (env.EXPO_PUBLIC_STAGING_BUILD !== '1') return;
  let origin;
  try { origin = new URL((env.EXPO_PUBLIC_API_URL || '').trim()); }
  catch { throw new Error('TestFlight staging requires an explicit HTTPS API origin.'); }
  const hostname = origin.hostname.toLowerCase().replace(/\.$/, '');
  if (origin.protocol !== 'https:' || !hostname || origin.username || origin.password ||
      (origin.pathname !== '/' && origin.pathname !== '') || origin.search || origin.hash ||
      hostname === 'foodlogger-yfn4.onrender.com' || env.EXPO_PUBLIC_ALLOW_SERVER_OVERRIDE === '1') {
    throw new Error('TestFlight staging requires a separate HTTPS origin without server overrides.');
  }
}
module.exports = { validateTestflightEnvironment };
