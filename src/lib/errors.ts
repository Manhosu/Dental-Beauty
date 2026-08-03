export class AppError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class ExternalApiError extends AppError {
  constructor(message: string, public readonly status: number, cause?: unknown) {
    super(message, cause);
  }
}

export class LockError extends AppError {}

export function isRetryable(err: unknown): boolean {
  if (err instanceof ExternalApiError) {
    return err.status === 429 || err.status >= 500;
  }
  return false;
}
