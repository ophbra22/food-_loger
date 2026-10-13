/**
 * Turns a failure into a translated message. Server text is English only, so the
 * app chooses its own wording from the error kind and what the user was doing.
 */
import type { TKey } from '@/i18n/translate';

import { ApiError, isApiError } from './errors';

export type ErrorContext =
  | 'signIn'
  | 'register'
  | 'recover'
  | 'photo'
  | 'barcodePhoto'
  | 'product'
  | 'saveCatalog'
  | 'saveCustom'
  | 'delete'
  | 'general';

export function errorMessageKey(error: unknown, context: ErrorContext = 'general'): TKey {
  if (!isApiError(error)) return 'errors.unknown';
  const specific = contextual(error, context);
  if (specific) return specific;
  switch (error.kind) {
    case 'draftCleanup':
      return 'review.cleanupFailed';
    case 'storage':
      return 'review.storageFailed';
    case 'draftFormat':
      return 'review.draftUnavailable';
    case 'config':
      return 'errors.config';
    case 'network':
      return 'errors.network';
    case 'timeout':
      return 'errors.timeout';
    case 'rateLimited':
      return 'errors.rateLimited';
    case 'tooLarge':
      return 'errors.tooLarge';
    case 'unavailable':
      return 'errors.unavailable';
    case 'validation':
      return 'errors.validation';
    case 'forbidden':
      return 'errors.forbidden';
    case 'notFound':
      return 'errors.notFound';
    case 'unauthorized':
      return 'auth.sessionExpired';
    default:
      return 'errors.server';
  }
}

function contextual(error: ApiError, context: ErrorContext): TKey | null {
  const { kind } = error;
  if (context === 'signIn') {
    if (kind === 'unauthorized' || kind === 'validation') return 'auth.invalidCredentials';
    if (kind === 'rateLimited') return 'auth.tooManyAttempts';
  }
  if (context === 'register') {
    if (kind === 'conflict') return 'auth.usernameTaken';
    if (kind === 'rateLimited') return 'auth.tooManyAttempts';
  }
  if (context === 'recover') {
    if (kind === 'unauthorized') return 'auth.invalidRecovery';
    if (kind === 'rateLimited') return 'auth.tooManyAttempts';
  }
  if (context === 'photo' || context === 'barcodePhoto') {
    // The server processes one image at a time and answers 429 while busy.
    if (kind === 'rateLimited' && error.retryAfterSeconds !== null && error.retryAfterSeconds <= 5) {
      return 'errors.busy';
    }
    if (kind === 'unavailable' && context === 'photo') return 'photo.modelUnavailable';
    if (kind === 'validation') {
      return context === 'photo' ? 'photo.imageRejected' : 'barcode.noBarcodeInPhoto';
    }
  }
  if (context === 'product') {
    if (kind === 'notFound') return 'barcode.notFoundBody';
    if (kind === 'unavailable') return 'barcode.unavailableBody';
    if (kind === 'validation') return 'validation.barcodeCheckDigit';
  }
  if ((context === 'saveCatalog' || context === 'saveCustom') && kind === 'conflict') return 'review.saveConflict';
  if (context === 'saveCatalog' && kind === 'notFound') return 'errors.foodGone';
  if ((context === 'saveCatalog' || context === 'saveCustom') && error.outcomeUnknown) {
    return 'review.saveUnknown';
  }
  if (context === 'delete' && kind === 'notFound') return 'meal.alreadyGone';
  return null;
}
