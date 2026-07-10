import type {
  AuthResponse,
  Booking,
  DashboardStats,
  Locale,
  MasterProfile,
  Role,
  Service,
  ShopSettings,
  User,
} from '@/types';

const TOKEN_KEY = 'levelup.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiRequestError';
  }
}

function currentLocale(): Locale {
  const lang = localStorage.getItem('i18nextLng') || 'en';
  return lang.startsWith('ru') ? 'ru' : 'en';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  headers.set('Accept-Language', currentLocale());
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = (body && (body.error || body.message)) || `Request failed (${res.status})`;
    throw new ApiRequestError(message, res.status);
  }
  return body as T;
}

const get = <T,>(path: string) => request<T>(path, { method: 'GET' });
const post = <T,>(path: string, data?: unknown) =>
  request<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined });
const put = <T,>(path: string, data?: unknown) =>
  request<T>(path, { method: 'PUT', body: data !== undefined ? JSON.stringify(data) : undefined });
const patch = <T,>(path: string, data?: unknown) =>
  request<T>(path, { method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined });
const del = <T,>(path: string) => request<T>(path, { method: 'DELETE' });

export const authApi = {
  login: (email: string, password: string) => post<AuthResponse>('/auth/login', { email, password }),
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    locale?: Locale;
  }) => post<AuthResponse>('/auth/register', data),
  me: () => get<{ user: User }>('/auth/me').then((r) => r.user),
  logout: () => post<void>('/auth/logout'),
};

export const servicesApi = {
  list: () => get<{ services: Service[] }>('/services').then((r) => r.services),
};

export const shopApi = {
  settings: () => get<{ shopSettings: ShopSettings }>('/shop-settings').then((r) => r.shopSettings),
};

export const mastersApi = {
  list: () => get<{ masters: MasterProfile[] }>('/masters').then((r) => r.masters),
  services: (masterId: string) =>
    get<{ services: Service[] }>(`/masters/${masterId}/services`).then((r) => r.services),
  bookableDays: (masterId: string, month: string) =>
    get<{ days: string[] }>(`/masters/${masterId}/availability?month=${month}`).then((r) => r.days),
  slots: (masterId: string, date: string, serviceIds: string[]) =>
    get<{ slots: string[] }>(
      `/masters/${masterId}/slots?date=${date}&serviceIds=${serviceIds.join(',')}`,
    ).then((r) => r.slots),
};

export const bookingsApi = {
  create: (data: { masterId: string; serviceIds: string[]; startAt: string }) =>
    post<{ booking: Booking }>('/bookings', data).then((r) => r.booking),
  mine: () => get<{ bookings: Booking[] }>('/bookings/me').then((r) => r.bookings),
  cancel: (id: string) => patch<{ booking: Booking }>(`/bookings/${id}/cancel`).then((r) => r.booking),
  reschedule: (id: string, startAt: string) =>
    patch<{ booking: Booking }>(`/bookings/${id}/reschedule`, { startAt }).then((r) => r.booking),
};

export const masterPanelApi = {
  bookings: () => get<{ bookings: Booking[] }>('/master-panel/bookings').then((r) => r.bookings),
  getAvailability: () => get<{ rules: unknown[]; overrides: unknown[] }>('/master-panel/availability'),
  putAvailability: (data: { rules: unknown[]; overrides: unknown[] }) =>
    put('/master-panel/availability', data),
};

export const adminApi = {
  stats: () => get<{ stats: DashboardStats }>('/admin/stats').then((r) => r.stats),
  masters: {
    list: () => get<{ masters: MasterProfile[] }>('/admin/masters').then((r) => r.masters),
    create: (data: Record<string, unknown>) =>
      post<{ master: MasterProfile }>('/admin/masters', data).then((r) => r.master),
    update: (id: string, data: Record<string, unknown>) =>
      patch<{ master: MasterProfile }>(`/admin/masters/${id}`, data).then((r) => r.master),
    remove: (id: string) => del<void>(`/admin/masters/${id}`),
  },
  services: {
    list: () => get<{ services: Service[] }>('/admin/services').then((r) => r.services),
    create: (data: Record<string, unknown>) =>
      post<{ service: Service }>('/admin/services', data).then((r) => r.service),
    update: (id: string, data: Record<string, unknown>) =>
      patch<{ service: Service }>(`/admin/services/${id}`, data).then((r) => r.service),
    remove: (id: string) => del<void>(`/admin/services/${id}`),
  },
  bookings: {
    list: (params?: { status?: string; masterId?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.masterId) q.set('masterId', params.masterId);
      const qs = q.toString();
      return get<{ bookings: Booking[] }>(`/admin/bookings${qs ? `?${qs}` : ''}`).then((r) => r.bookings);
    },
  },
  settings: {
    get: () => get<{ shopSettings: ShopSettings }>('/shop-settings').then((r) => r.shopSettings),
    update: (data: Partial<ShopSettings>) =>
      put<{ shopSettings: ShopSettings }>('/admin/shop-settings', data).then((r) => r.shopSettings),
  },
};

export function roleHome(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'master') return '/master';
  return '/account';
}
