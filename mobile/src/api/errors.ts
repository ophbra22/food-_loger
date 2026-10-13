export type ApiErrorKind =
  | 'storage'
  | 'draftFormat'
  | 'draftCleanup'
  | 'config' // no server address in this build
  | 'network' // no connection, DNS failure, server not reachable
  | 'timeout'
  | 'unauthorized' // 401: session missing, expired or revoked
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'validation' // 422
  | 'tooLarge' // 413
  | 'rateLimited' // 429
  | 'unavailable' // 502, 503, 504
  | 'server';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  /** English text from the server. For logs only; the UI shows translated messages. */
  readonly detail: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    kind: ApiErrorKind,
    options: { status?: number; detail?: string | null; retryAfterSeconds?: number | null } = {},
  ) {
    super(options.detail ?? kind);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.detail = options.detail ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }

  /**
   * True when the request may have reached the server even though no answer came back.
   * A save that fails this way must be retried with the same Idempotency-Key.
   */
  get outcomeUnknown() {
    return this.kind === 'network' || this.kind === 'timeout';
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 408) return 'timeout';
  if (status === 409) return 'conflict';
  if (status === 413) return 'tooLarge';
  if (status === 422 || status === 400) return 'validation';
  if (status === 429) return 'rateLimited';
  if (status === 502 || status === 503 || status === 504) return 'unavailable';
  return 'server';
}
