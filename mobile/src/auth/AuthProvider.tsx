import {allowPrivateExports,stopPrivateExports} from '@/storage/export-session';
import {stopWidgetSession,allowWidgetSession} from '@/native/widgets/session';
import {stopHealthSession} from '@/native/health/session';
import {stopNotificationSession} from '@/native/notifications';
import * as Apple from 'expo-apple-authentication';
import { AppState, Platform } from 'react-native';
import { requestAppleProof } from './apple-auth';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { isApiError } from '@/api/errors';
import { createApiClient } from '@/api/client';
import { Api, createApi } from '@/api/endpoints';
import type { SessionResponse, User } from '@/api/types';
import { DEFAULT_API_URL, normalizeServerUrl } from '@/config/env';
import { JournalStore } from '@/data/journal-store';
import { clearAccount, openAccountStorage, globalKey, readJson, remove, writeJson } from '@/storage/kv';

import { clearPrivateFiles } from '@/storage/private-files';

import { StoredSession, sessionStore } from './session-store';

const SERVER_KEY = globalKey('server-url');

type Status = 'loading' | 'signedOut' | 'signedIn';

type AuthValue = {
  status: Status;
  widgetCleanupError:boolean;
  retryWidgetCleanup:()=>Promise<void>;
  user: User | null;
  /** A recovery code that must be shown before the journal opens. */
  pendingRecoveryCode: string | null;
  /** True after the server ended the session, until the notice is dismissed. */
  sessionExpired: boolean;
  api: Api;
  /** Journal data for the signed-in account; null when signed out. */
  journal: JournalStore | null;
  serverUrl: string;
  signInWithApple: () => Promise<void>;
  linkApple: () => Promise<void>;
  deleteWithApple: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  recover: (username: string, recoveryCode: string, newPassword: string) => Promise<void>;
  confirmRecoveryCodeSaved: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
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
  const [widgetCleanupError,setWidgetCleanupError]=useState(false);
  const [widgetCleanupAttempt,setWidgetCleanupAttempt]=useState(0);
  const clearWidgets=useCallback(()=>{try{stopWidgetSession(true);setWidgetCleanupError(false);return true;}catch{setWidgetCleanupError(true);return false;}},[]);
  const retryWidgetCleanup=useCallback(async()=>{setWidgetCleanupAttempt(v=>v+1);},[]);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [serverUrl, setServerUrlState] = useState(DEFAULT_API_URL);

  const sessionOwner = useRef<string | null>(null);
  const activeJournal = useRef<JournalStore | null>(null);
  const endSession = useCallback(async (expired: boolean, storedOwner?: string) => {
    const owner = storedOwner ?? sessionOwner.current;
    stopPrivateExports();
    clearWidgets();
    stopHealthSession();
    stopNotificationSession();
    sessionOwner.current = null;
    activeJournal.current?.close();
    link.token = null;
    setSession(null);
    setStatus('signedOut');
    if (expired) setSessionExpired(true);
    await sessionStore.clear();
    if(expired && owner) {
      try { await clearAccount(owner); } finally { clearPrivateFiles(); }
    }
  }, [clearWidgets]);

  useEffect(() => {
    link.onSessionRejected = (token) => {
      // Ignore answers to requests made with a token that was already replaced.
      if (token === link.token) void endSession(true).catch(() => undefined);
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
  useEffect(() => { activeJournal.current=journal; return () => journal?.close(); }, [journal]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      stopPrivateExports();
      if(!clearWidgets())return;
      setStatus('loading');
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
        await endSession(true, stored.user.id);
        return;
      }
      sessionOwner.current=stored.user.id;
      openAccountStorage(stored.user.id);
      allowWidgetSession();
      allowPrivateExports();
      link.token = stored.token;
      setSession(stored);
      setStatus('signedIn');
      // Confirm with the server in the background. Offline, the saved session keeps working
      // for reading the phone's copy; a 401 ends it through onSessionRejected.
      api.me().then(async response => {
        if (!response.user || cancelled || link.token !== stored.token) return;
        const refreshed = { ...stored, user: response.user };
        await sessionStore.write(refreshed);
        if (!cancelled && link.token === stored.token) setSession(refreshed);
      }).catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [endSession,clearWidgets,widgetCleanupAttempt]);

  const open = useCallback(async (response: SessionResponse, appleSignIn = false) => {
    const next: StoredSession = {
      token: response.session_token,
      appleSignIn,
      user: response.user,
      expiresAt: Date.now() + response.expires_in * 1000,
      pendingRecoveryCode: response.recovery_code,
    };
    stopPrivateExports();
    stopWidgetSession(true);
    setWidgetCleanupError(false);
    await sessionStore.write(next);
    sessionOwner.current=next.user.id;
    openAccountStorage(next.user.id);
    allowWidgetSession();
      allowPrivateExports();
    link.token = next.token;
    setSessionExpired(false);
    setSession(next);
    setStatus('signedIn');
  }, []);

  const signIn = useCallback(
    async (username: string, password: string) => open(await api.login(username.trim(), password)),
    [open],
  );
  const signInWithApple = useCallback(async () => {
    const proof = await requestAppleProof(await api.appleChallenge('login'));
    await open(await api.appleLogin(proof), true);
  }, [open]);

  const linkApple = useCallback(async () => {
    if (!session) return;
    const token = session.token;
    const proof = await requestAppleProof(await api.appleChallenge('link'));
    const response = await api.appleLink(proof);
    if (link.token !== token) return;
    const next = { ...session, user: response.user };
    await sessionStore.write(next);
    setSession(next);
  }, [session]);

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
    stopPrivateExports();
    clearWidgets();
    stopHealthSession();
    try {
      // Revoke the token on the server when it can be reached.
      await api.logout();
    } catch {
      // Offline or already expired: the phone still forgets the token below.
    }
    journal?.close();
    await endSession(false);
    if (userId) await clearAccount(userId);
    clearPrivateFiles();
  }, [endSession, userId, journal,clearWidgets]);

  const finishDeletion = useCallback(async () => {
    stopPrivateExports();
    clearWidgets();
    stopHealthSession();
    if (!userId) return;
    journal?.close();
    await clearAccount(userId);
    clearPrivateFiles();
    await sessionStore.clear(true);
    await endSession(false);
  }, [userId, journal, endSession,clearWidgets]);

  const deleteAccount = useCallback(async (password: string) => {
    if (!userId) return;
    try { await api.deleteAccount(password); }
    catch (error) {
      if (!isApiError(error) || error.kind !== 'unauthorized') throw error;
    }
    await finishDeletion();
  }, [userId, finishDeletion]);

  const deleteWithApple = useCallback(async () => {
    const proof = await requestAppleProof(await api.appleChallenge('delete'));
    await api.appleDelete(proof);
    await finishDeletion();
  }, [finishDeletion]);

  useEffect(() => {
    const subject = session?.user.apple_subject;
    if (Platform.OS !== 'ios' || !subject || !session?.appleSignIn) return;
    const check = () => Apple.getCredentialStateAsync(subject).then(state => {
      if (state === Apple.AppleAuthenticationCredentialState.REVOKED ||
          state === Apple.AppleAuthenticationCredentialState.NOT_FOUND) void signOut();
    }).catch(() => undefined);
    void check();
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') void check();
    });
    const revoked = Apple.addRevokeListener(() => { void check(); });
    return () => { foreground.remove(); revoked.remove(); };
  }, [session?.user.apple_subject, session?.appleSignIn, signOut]);

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
      status,widgetCleanupError,retryWidgetCleanup,
      user: session?.user ?? null,
      pendingRecoveryCode: session?.pendingRecoveryCode ?? null,
      sessionExpired,
      api,
      journal,
      serverUrl,
      signIn,
      signInWithApple,
      linkApple,
      deleteWithApple,
      register,
      recover,
      confirmRecoveryCodeSaved,
      signOut,
      deleteAccount,
      dismissSessionExpired: () => setSessionExpired(false),
      setServerUrl,
    }),
    [
      status,widgetCleanupError,retryWidgetCleanup,
      session,
      sessionExpired,
      journal,
      serverUrl,
      signIn,
      signInWithApple,
      linkApple,
      deleteWithApple,
      register,
      recover,
      confirmRecoveryCodeSaved,
      signOut,
      deleteAccount,
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
