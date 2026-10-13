import { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '@/api/errors';
import { accountKey, openAccountStorage, writeJson } from '@/storage/kv';
import { AuthProvider, useAuth } from '../AuthProvider';
import { clearPrivateFiles } from '@/storage/private-files';
import { sessionStore } from '../session-store';

jest.mock('@/storage/private-files', () => ({ clearPrivateFiles: jest.fn() }));
const mockDelete = jest.fn();
const mockAppleLink = jest.fn();
const mockAppleDelete = jest.fn();
const mockAppleChallenge = jest.fn();
const mockAppleProof = { challenge_id: 'challenge', identity_token: 'identity', authorization_code: 'code' };
jest.mock('../apple-auth', () => ({ requestAppleProof: async () => mockAppleProof }));
jest.mock('@/api/endpoints', () => ({ createApi: () => ({
  me: async () => ({}), deleteAccount: (...args: unknown[]) => mockDelete(...args),
  appleChallenge: (...args: unknown[]) => mockAppleChallenge(...args),
  appleLink: (...args: unknown[]) => mockAppleLink(...args),
  appleDelete: (...args: unknown[]) => mockAppleDelete(...args),
}) }));
jest.mock('../session-store', () => ({ sessionStore: {
  read: jest.fn(), write: jest.fn(), clear: jest.fn(),
} }));
let auth: ReturnType<typeof useAuth>;
function Probe() { const value = useAuth(); useEffect(() => { auth = value; }, [value]); return null; }
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  openAccountStorage('alice'); openAccountStorage('bob');
  jest.mocked(sessionStore.read).mockResolvedValue({ token: 'alice-token',
    user: { id: 'alice', username: 'alice' }, expiresAt: Date.now() + 60000 });
  await writeJson(accountKey('alice', 'draft'), { name: 'private draft' });
  await writeJson(accountKey('alice', 'day:today'), { meals: ['private'] });
  await writeJson(accountKey('bob', 'draft'), { name: 'other account' });
  await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(auth.status).toBe('signedIn'));
});
it('forgets credentials, draft, cached days and the live journal only after deletion succeeds', async () => {
  mockDelete.mockResolvedValue(undefined);
  const oldJournal = auth.journal!;
  const close = jest.spyOn(oldJournal, 'close');
  await act(async () => auth.deleteAccount('current-password'));
  expect(mockDelete).toHaveBeenCalledWith('current-password');
  expect(auth.status).toBe('signedOut');
  expect(auth.journal).toBeNull();
  expect(close).toHaveBeenCalled();
  expect(clearPrivateFiles).toHaveBeenCalled();
  expect(sessionStore.clear).toHaveBeenCalled();
  expect(await AsyncStorage.getItem(accountKey('alice', 'draft'))).toBeNull();
  expect(await AsyncStorage.getItem(accountKey('alice', 'day:today'))).toBeNull();
  expect(await AsyncStorage.getItem(accountKey('bob', 'draft'))).toContain('other account');
});
it.each(['forbidden', 'network', 'unavailable'] as const)('keeps the account and draft after %s', async kind => {
  mockDelete.mockRejectedValue(new ApiError(kind));
  await act(async () => { await expect(auth.deleteAccount('password')).rejects.toMatchObject({ kind }); });
  expect(auth.status).toBe('signedIn');
  expect(sessionStore.clear).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(accountKey('alice', 'draft'))).toContain('private draft');
});
it('safely clears local data when a retry finds the token already revoked', async () => {
  mockDelete.mockRejectedValue(new ApiError('unauthorized'));
  await act(async () => auth.deleteAccount('password'));
  expect(auth.status).toBe('signedOut');
  expect(await AsyncStorage.getItem(accountKey('alice', 'draft'))).toBeNull();
});

it('links Apple without replacing the session, journal or cached draft', async () => {
  const journal = auth.journal;
  mockAppleChallenge.mockResolvedValue({ challenge_id: 'challenge', nonce: 'nonce' });
  mockAppleLink.mockResolvedValue({ user: { id: 'alice', username: 'alice', apple_linked: true, apple_subject: 'apple-alice' } });
  await act(async () => auth.linkApple());
  expect(mockAppleChallenge).toHaveBeenCalledWith('link');
  expect(mockAppleLink).toHaveBeenCalledWith(mockAppleProof);
  expect(auth.journal).toBe(journal);
  expect(auth.user?.apple_linked).toBe(true);
  expect(sessionStore.write).toHaveBeenCalledWith(expect.objectContaining({ token: 'alice-token' }));
  expect(await AsyncStorage.getItem(accountKey('alice', 'draft'))).toContain('private draft');
});
it('preserves the journal if Apple account linking conflicts', async () => {
  mockAppleLink.mockRejectedValue(new ApiError('conflict'));
  await act(async () => { await expect(auth.linkApple()).rejects.toMatchObject({ kind: 'conflict' }); });
  expect(auth.status).toBe('signedIn');
  expect(sessionStore.write).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(accountKey('alice', 'draft'))).toContain('private draft');
});
it('clears only the current account after verified Apple deletion', async () => {
  mockAppleDelete.mockResolvedValue(undefined);
  await act(async () => auth.deleteWithApple());
  expect(mockAppleChallenge).toHaveBeenCalledWith('delete');
  expect(mockAppleDelete).toHaveBeenCalledWith(mockAppleProof);
  expect(auth.status).toBe('signedOut');
  expect(await AsyncStorage.getItem(accountKey('alice', 'draft'))).toBeNull();
  expect(await AsyncStorage.getItem(accountKey('bob', 'draft'))).toContain('other account');
});
it('preserves data if Apple deletion cannot revoke access', async () => {
  mockAppleDelete.mockRejectedValue(new ApiError('unavailable'));
  await act(async () => { await expect(auth.deleteWithApple()).rejects.toMatchObject({ kind: 'unavailable' }); });
  expect(auth.status).toBe('signedIn');
  expect(sessionStore.clear).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(accountKey('alice', 'draft'))).toContain('private draft');
});
