// Small typed fetch wrapper shared by the workshop and the teacher panel.
import type { ApiErrorBody } from '../shared/api.ts';

/** A failed request. `status` is 0 when the server could not be reached at all. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export const NETWORK_MESSAGE = 'No pudimos conectar con el servidor.';

export interface RequestOptions {
  body?: unknown;
  keepalive?: boolean;
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const parsed = (await response.json()) as Partial<ApiErrorBody>;
    if (parsed.error && typeof parsed.error.message === 'string') {
      return new ApiError(response.status, String(parsed.error.code ?? 'error'), parsed.error.message);
    }
  } catch {
    // Not JSON: a proxy error page, for example.
  }
  // A dev proxy answers 5xx with an empty body when the API is down: treat as unreachable.
  if (response.status >= 502 && response.status <= 504) {
    return new ApiError(0, 'network', NETWORK_MESSAGE);
  }
  return new ApiError(response.status, 'error', 'Algo salió mal. Probá de nuevo.');
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', keepalive: options.keepalive };
  if (options.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(options.body);
  }
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(0, 'network', NETWORK_MESSAGE);
  }
  if (!response.ok) throw await readError(response);
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(0, 'network', NETWORK_MESSAGE);
  }
}

export const get = <T>(path: string): Promise<T> => request<T>('GET', path);
export const send = <T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> =>
  request<T>(method, path, { body });
