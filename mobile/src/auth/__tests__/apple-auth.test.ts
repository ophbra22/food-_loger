import * as Apple from 'expo-apple-authentication';
import { requestAppleProof } from '../apple-auth';

jest.mock('expo-apple-authentication', () => ({ signInAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({
  randomUUID: () => 'random-state', CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async () => 'hashed-server-nonce',
}));
const challenge = { challenge_id: 'one-use-id', nonce: 'server-nonce' };
const credential = { identityToken: 'signed-proof', authorizationCode: 'one-use-code',
  state: 'random-state', user: 'apple-subject' };

it('binds the native Apple request to the server nonce and returns only the required proof', async () => {
  jest.mocked(Apple.signInAsync).mockResolvedValue(credential as Apple.AppleAuthenticationCredential);
  const result = await requestAppleProof(challenge);
  expect(Apple.signInAsync).toHaveBeenCalledWith(expect.objectContaining({
    nonce: 'hashed-server-nonce', state: 'random-state',
  }));
  expect(result).toEqual({ challenge_id: 'one-use-id', identity_token: 'signed-proof',
    authorization_code: 'one-use-code' });
});
it.each([
  { ...credential, state: 'different-state' },
  { ...credential, identityToken: null },
  { ...credential, authorizationCode: null },
])('rejects mismatched or incomplete Apple results', async result => {
  jest.mocked(Apple.signInAsync).mockResolvedValue(result as Apple.AppleAuthenticationCredential);
  await expect(requestAppleProof(challenge)).rejects.toThrow();
});
it('preserves cancellation so the UI does not report a failed login', async () => {
  jest.mocked(Apple.signInAsync).mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
  await expect(requestAppleProof(challenge)).rejects.toEqual({ code: 'ERR_REQUEST_CANCELED' });
});
