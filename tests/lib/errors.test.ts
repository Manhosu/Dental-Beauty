import { describe, it, expect } from 'vitest';
import { AppError, ExternalApiError, isRetryable } from '../../src/lib/errors';

describe('errors', () => {
  it('ExternalApiError 429 é retryable', () => {
    expect(isRetryable(new ExternalApiError('rate limit', 429))).toBe(true);
  });
  it('ExternalApiError 500 é retryable', () => {
    expect(isRetryable(new ExternalApiError('server', 503))).toBe(true);
  });
  it('ExternalApiError 400 é fatal', () => {
    expect(isRetryable(new ExternalApiError('bad', 400))).toBe(false);
  });
  it('AppError genérico é fatal', () => {
    expect(isRetryable(new AppError('x'))).toBe(false);
  });
});
