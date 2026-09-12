const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const TOKEN_KEY = 'meridian.token';

/** localStorage is unavailable during SSR and can throw in private windows. */
export function getToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked - the session simply won't survive a reload */
  }
}

/** Thrown for any non-2xx response, carrying the API's own message. */
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  /** "field: message" lines, for rendering validation feedback. */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return this.details.reduce((acc, d) => ({ ...acc, [d.field]: d.message }), {});
  }
}

async function request(path, { method = 'GET', body, auth = true, signal, form } = {}) {
  const token = auth ? getToken() : null;

  // For multipart the browser must set Content-Type itself, so it can add the
  // boundary - setting it by hand produces an unparseable request.
  const requestBody = form ?? (body ? JSON.stringify(body) : undefined);

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body && !form ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(requestBody !== undefined ? { body: requestBody } : {}),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Cannot reach the server. Is the API running on port 4000?');
  }

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* some errors carry no body */
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.message ?? `Request failed (${response.status})`,
      payload?.error?.details
    );
  }

  return payload;
}

/** Drop undefined/empty values so they don't become "undefined" in the URL. */
function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

export const api = {
  auth: {
    register: (body) => request('/api/auth/register', { method: 'POST', body, auth: false }),
    login: (body) => request('/api/auth/login', { method: 'POST', body, auth: false }),
    me: (signal) => request('/api/auth/me', { signal }),
    updateProfile: (body) => request('/api/auth/me', { method: 'PATCH', body }),
    changePassword: (body) => request('/api/auth/change-password', { method: 'POST', body }),
  },

  hotels: {
    list: (params) => request(`/api/hotels${qs(params)}`, { auth: !!getToken() }),
    get: (id) => request(`/api/hotels/${id}`, { auth: !!getToken() }),
    create: (body) => request('/api/hotels', { method: 'POST', body }),
    update: (id, body) => request(`/api/hotels/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/hotels/${id}`, { method: 'DELETE' }),
  },

  rooms: {
    list: (params) => request(`/api/rooms${qs(params)}`, { auth: !!getToken() }),
    get: (id) => request(`/api/rooms/${id}`, { auth: false }),
    types: (params) => request(`/api/rooms/types${qs(params)}`, { auth: false }),
    availability: (params, signal) =>
      request(`/api/rooms/availability${qs(params)}`, { auth: !!getToken(), signal }),
    /** Is this one room free for this stay? Used by the room page. */
    checkAvailability: (id, params, signal) =>
      request(`/api/rooms/${id}/availability${qs(params)}`, { auth: false, signal }),
    calendar: (id, params) => request(`/api/rooms/${id}/calendar${qs(params)}`),
    create: (body) => request('/api/rooms', { method: 'POST', body }),
    update: (id, body) => request(`/api/rooms/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/rooms/${id}`, { method: 'DELETE' }),
  },

  bookings: {
    list: (params) => request(`/api/bookings${qs(params)}`),
    get: (id) => request(`/api/bookings/${id}`),
    create: (body) => request('/api/bookings', { method: 'POST', body }),
    modify: (id, body) => request(`/api/bookings/${id}`, { method: 'PATCH', body }),
    cancellationPolicy: (id) => request(`/api/bookings/${id}/cancellation-policy`),
    cancel: (id, body) => request(`/api/bookings/${id}/cancel`, { method: 'POST', body }),
    setStatus: (id, status) =>
      request(`/api/bookings/${id}/status`, { method: 'PATCH', body: { status } }),
    frontDesk: () => request('/api/bookings/front-desk'),
  },

  cancellations: {
    list: (params) => request(`/api/cancellation-requests${qs(params)}`),
    get: (id) => request(`/api/cancellation-requests/${id}`),
    review: (id, body) =>
      request(`/api/cancellation-requests/${id}/review`, { method: 'POST', body }),
  },

  users: {
    list: (params) => request(`/api/users${qs(params)}`),
    get: (id) => request(`/api/users/${id}`),
    create: (body) => request('/api/users', { method: 'POST', body }),
    update: (id, body) => request(`/api/users/${id}`, { method: 'PATCH', body }),
    deactivate: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),
    dashboard: () => request('/api/users/dashboard'),
  },

  /**
   * Galleries. The same endpoints hang off both /hotels/:id and /rooms/:id,
   * so one helper serves both - `owner` is 'hotels' or 'rooms'.
   */
  images: {
    list: (owner, id) => request(`/api/${owner}/${id}/images`, { auth: false }),

    upload: (owner, id, files, alt) => {
      const form = new FormData();
      for (const file of files) form.append('images', file);
      if (alt) form.append('alt', alt);
      return request(`/api/${owner}/${id}/images`, { method: 'POST', form });
    },

    update: (owner, id, imageId, body) =>
      request(`/api/${owner}/${id}/images/${imageId}`, { method: 'PATCH', body }),

    reorder: (owner, id, orderedIds) =>
      request(`/api/${owner}/${id}/images/order`, { method: 'PATCH', body: { orderedIds } }),

    remove: (owner, id, imageId) =>
      request(`/api/${owner}/${id}/images/${imageId}`, { method: 'DELETE' }),
  },

  /**
   * The RAG concierge (see agent/). Public: a guest asks before signing in.
   * `history` lets the agent resolve a terse follow-up like "and the spa?".
   */
  chat: {
    ask: (message, history = [], signal) =>
      request('/api/chat', {
        method: 'POST',
        body: { message, history },
        auth: !!getToken(),
        signal,
      }),
    health: () => request('/api/chat/health', { auth: false }),
  },

  health: () => request('/health', { auth: false }),
};
