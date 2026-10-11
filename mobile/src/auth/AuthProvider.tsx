import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { createApiClient } from '@/api/client';
import { Api, createApi } from '@/api/endpoints';
import type { SessionResponse, User } from '@/api/types';
import { DEFAULT_API_URL, normalizeServerUrl } from '@/config/env';
import { JournalStore } from '@/data/journal-store';
import { clearAccount, globalKey, readJson, remove, writeJson } from '@/storage/kv';

import { StoredSession, sessionStore } from './session-store';

const SERVER_KEY = globalKey('server-url');

type Status = 'loading' | 'signedOut' | 'signedIn';

type AuthValue = {
  status: Status;
  user: User | null;
  /** A recovery code that must be shown before the journal opens. */
  pendingRecoveryCode: string | null;
  /** True after the server ended the session, until the notice is dismissed. */
  sessionExpired: boolean;
  api: Api;
  /** Journal data for the signed-in account; null when signed out. */
  journal: JournalStore | null;
  serverUrl: string;
  signIn: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  recover: (username: string, recoveryCode: string, newPassword: string) => Promise<void>;
  confirmRecoveryCodeSaved: () => Promise<void>;
  signOut: () => Promise<void>;
  dismissSessionExpired: () => void;
  /** Point the app at another server (test builds). Signs out. Pass null for the built-in address. */
  setServerUrl: (url: string | null) => Promise<boolean>;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * What the API client reads at request time. It lives outside React so a request
 * always uses the current token and server, never a value captured by an old render.
 */
const link = {
  token: null as string | null,
  server: DEFAULT_API_URL,
  onSessionRejected: (_token: string) => {},
};
const api: Api = createApi(
  createApiClient({
    baseUrl: () => link.server,
    token: () => link.token,
    onSessionRejected: (token) => link.onSessionRejected(token),
  }),
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<StoredSession | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [serverUrl, setServerUrlState] = useState(DEFAULT_API_URL);

  const endSession = useCallback(async (expired: boolean) => {
    link.token = null;
    setSession(null);
    setStatus('signedOut');
    if (expired) setSessionExpired(true);
    await sessionStore.clear();
  }, []);

  useEffect(() => {
    link.onSessionRejected = (token) => {
      // Ignore answers to requests made with a token that was already replaced.
      if (token === link.token) void endSession(true);
    };
    return () => {
      link.onSessionRejected = () => {};
    };
  }, [endSession]);

  // Keep the request-time values in step with React state (also across development reloads).
  useEffect(() => {
    if (status !== 'loading') link.token = session?.token ?? null;
  }, [status, session]);

  // A new store per account: nothing from the previous account is reachable.
  const userId = session?.user.id ?? null;
  const journal = useMemo(() => (userId ? new JournalStore(userId, api) : null), [userId]);
  useEffect(() => () => journal?.close(), [journal]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedServer = await readJson<string>(SERVER_KEY);
      const server = (savedServer && normalizeServerUrl(savedServer)) || DEFAULT_API_URL;
      link.server = server;
      const stored = await sessionStore.read();
      if (cancelled) return;
      setServerUrlState(server);
      if (!stored) {
        setStatus('signedOut');
        return;
      }
      if (stored.expiresAt <= Date.now()) {
        await endSession(true);
        return;
      }
      link.token = stored.token;
      setSession(stored);
      setStatus('signedIn');
      // Confirm with the server in the background. Offline, the saved session keeps working
      // for reading the phone's copy; a 401 ends it through onSessionRejected.
      api.me().catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [endSession]);

  const open = useCallback(async (response: SessionResponse) => {
    const next: StoredSession = {
      token: response.session_token,
      user: response.user,
      expiresAt: Date.now() + response.expires_in * 1000,
      pendingRecoveryCode: response.recovery_code,
    };
    await sessionStore.write(next);
    link.token = next.token;
    setSessionExpired(false);
    setSession(next);
    setStatus('signedIn');
  }, []);

  const signIn = useCallback(
    async (username: string, password: string) => open(await api.login(username.trim(), password)),
    [open],
  );
  const register = useCallback(
    async (username: string, password: string) =>
      open(await api.register(username.trim(), password)),
    [open],
  );
  const recover = useCallback(
    async (username: string, recoveryCode: string, newPassword: string) =>
      open(await api.recover(username.trim(), recoveryCode, newPassword)),
    [open],
  );

  const confirmRecoveryCodeSaved = useCallback(async () => {
    if (!session) return;
    const next: StoredSession = { ...session, pendingRecoveryCode: undefined };
    await sessionStore.write(next);
    setSession(next);
  }, [session]);

  const signOut = useCallback(async () => {
    try {
      // Revoke the token on the server when it can be reached.
      await api.logout();
    } catch {
      // Offline or already expired: the phone still forgets the token below.
    }
    await endSession(false);
    if (userId) await clearAccount(userId);
  }, [endSession, userId]);

  const setServerUrl = useCallback(
    async (url: string | null) => {
      const next = url === null ? DEFAULT_API_URL : normalizeServerUrl(url);
      if (!next) return false;
      if (session) await signOut();
      if (url === null) await remove(SERVER_KEY);
      else await writeJson(SERVER_KEY, next);
      link.server = next;
      setServerUrlState(next);
      return true;
    },
    [session, signOut],
  );

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user: session?.user ?? null,
      pendingRecoveryCode: session?.pendingRecoveryCode ?? null,
      sessionExpired,
      api,
      journal,
      serverUrl,
      signIn,
      register,
      recover,
      confirmRecoveryCodeSaved,
      signOut,
      dismissSessionExpired: () => setSessionExpired(false),
      setServerUrl,
    }),
    [
      status,
      session,
      sessionExpired,
      journal,
      serverUrl,
      signIn,
      register,
      recover,
      confirmRecoveryCodeSaved,
      signOut,
      setServerUrl,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
