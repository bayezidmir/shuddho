const TOKEN_STORAGE_KEY = 'shuddho_admin_token';

export function getAdminToken(): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null | undefined): void {
  try {
    if (typeof window === 'undefined') return;
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearAdminToken(): void {
  setAdminToken(null);
}

let fetchPatched = false;
let onUnauthorizedCallback: (() => void) | null = null;

export function installAdminFetchInterceptor(onUnauthorized?: () => void): void {
  if (onUnauthorized) {
    onUnauthorizedCallback = onUnauthorized;
  }
  if (typeof window === 'undefined' || fetchPatched) return;
  fetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isAdminApi = urlStr.startsWith('/api/admin/') || urlStr.includes('/api/admin/');
    const isLoginEndpoint = urlStr.includes('/api/admin/auth/login');

    let nextInit = init;
    if (isAdminApi && !isLoginEndpoint) {
      const token = getAdminToken();
      if (token) {
        const headers = new Headers(
          init?.headers ?? (typeof input !== 'string' && !(input instanceof URL) ? input.headers : undefined),
        );
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        nextInit = { ...init, headers, credentials: init?.credentials ?? 'same-origin' };
      }
    }

    const resp = await originalFetch(input, nextInit);
    if (
      resp.status === 401 &&
      isAdminApi &&
      !isLoginEndpoint &&
      !urlStr.includes('/api/admin/auth/me')
    ) {
      clearAdminToken();
      onUnauthorizedCallback?.();
    }
    return resp;
  };
}
