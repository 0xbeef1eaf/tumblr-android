/**
 * Typed API errors. These are the only classes in the codebase: subclassing `Error` is
 * the idiomatic way to get `instanceof` narrowing and stack traces.
 */
export interface ApiErrorInit {
  status: number;
  message?: string;
  code?: number | string;
  detail?: string;
  retryAfterSec?: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: number | string;
  readonly detail?: string;
  readonly retryAfterSec?: number;

  constructor(init: ApiErrorInit) {
    super(init.message ?? init.detail ?? `Tumblr API error ${init.status}`);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.detail = init.detail;
    this.retryAfterSec = init.retryAfterSec;
    // Keep `instanceof` working when classes are down-levelled by Babel.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export class NotFoundError extends ApiError {
  constructor(init: Omit<ApiErrorInit, 'status'> = {}) {
    super({ ...init, status: 404 });
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}
