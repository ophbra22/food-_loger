import * as Apple from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

export type AppleChallenge = { challenge_id: string; nonce: string };
export type AppleProof = {
  challenge_id: string;
  identity_token: string;
  authorization_code: string;
};

export async function requestAppleProof(challenge: AppleChallenge): Promise<AppleProof> {
  const state = Crypto.randomUUID();
  const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, challenge.nonce);
  const credential = await Apple.signInAsync({ requestedScopes: [], nonce, state });
  if (credential.state !== state || !credential.identityToken || !credential.authorizationCode) {
    throw new Error('Incomplete Apple sign-in response');
  }
  return { challenge_id: challenge.challenge_id, identity_token: credential.identityToken,
    authorization_code: credential.authorizationCode };
}
