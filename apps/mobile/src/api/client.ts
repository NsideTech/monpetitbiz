import {API_BASE_URL} from '../config';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string | null;
  body?: Record<string, unknown>;
};

let onUnauthorized: (() => void) | null = null;

export const setOnUnauthorized = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
      throw new Error('Session expired');
    }

    const errorText = await response.text();
    console.error('[API] Request failed', {
      url,
      status: response.status,
      body: options.body ?? null,
      errorText,
    });
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};
