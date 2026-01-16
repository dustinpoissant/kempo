const API_BASE = '/kempo/api';

/*
  Helper Functions
*/

const pendingRequests = new Map();

const createRequestKey = (url, options = {}) => {
  const method = options.method || 'GET';
  const body = options.body || '';
  return `${method}:${url}:${body}`;
};

const deferredFetch = (url, options) => {
  const key = createRequestKey(url, options);
  
  if(pendingRequests.has(key)){
    return new Promise((resolve, reject) => {
      pendingRequests.get(key).callbacks.add({ resolve, reject });
    });
  }
  
  const callbacks = new Set();
  const fetchPromise = fetch(url, options)
    .then(response => {
      callbacks.forEach(({ resolve }) => resolve(response.clone()));
      pendingRequests.delete(key);
      return response;
    })
    .catch(error => {
      callbacks.forEach(({ reject }) => reject(error));
      pendingRequests.delete(key);
      throw error;
    });
  
  pendingRequests.set(key, { fetchPromise, callbacks });
  return fetchPromise;
};

const handleResponse = async (response) => {
  if(!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch(e) {
      throw new Error('Service temporarily unavailable. Please try again later.');
    }
    const error = new Error(errorData.error || errorData.message || 'An error occurred');
    error.status = response.status;
    error.data = errorData;
    throw error;
  }
  
  try {
    return await response.json();
  } catch(e) {
    throw new Error('Service temporarily unavailable. Please try again later.');
  }
};

const fetchWithErrorHandling = async (url, options, fallbackError) => {
  try {
    const response = await deferredFetch(url, options);
    return await handleResponse(response);
  } catch(error) {
    if(error.message === 'Service temporarily unavailable. Please try again later.' || error.message.includes('Failed to fetch')) {
      throw new Error('Service temporarily unavailable. Please try again later.');
    }
    throw new Error(error.message || fallbackError);
  }
};

/*
  Auth SDK
*/

export const register = async ({ email, password, name }) =>
  fetchWithErrorHandling(
    `${API_BASE}/auth/register/email`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    },
    'Registration failed'
  );

export const login = async ({ email, password }) =>
  fetchWithErrorHandling(
    `${API_BASE}/auth/login/email`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    'Login failed'
  );

export const logout = async () =>
  fetchWithErrorHandling(
    `${API_BASE}/auth/logout`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    'Logout failed'
  );

export const getSession = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await deferredFetch(`${API_BASE}/auth/session`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if(!response.ok && response.status === 404) return null;
    return await handleResponse(response);
  } catch(error) {
    clearTimeout(timeoutId);
    if(error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    if(error.message === 'Service temporarily unavailable. Please try again later.' || error.message.includes('Failed to fetch')) {
      throw new Error('Service temporarily unavailable. Please try again later.');
    }
    throw new Error(error.message || 'Failed to get session');
  }
};

export const forgotPassword = async ({ email }) =>
  fetchWithErrorHandling(
    `${API_BASE}/forgot-password`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    },
    'Password reset request failed'
  );

export const resetPassword = async ({ token, password, logoutAll = false }) =>
  fetchWithErrorHandling(
    `${API_BASE}/auth/reset-password`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: password, logoutAll }),
    },
    'Password reset failed'
  );
  
export const changePassword = async ({ currentPassword, newPassword, logoutAll }) => 
  fetchWithErrorHandling(
    `${API_BASE}/auth/change-password`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, logoutAll }),
    },
    'Password change failed'
  );

export const verifyEmail = async ({ token }) =>
  fetchWithErrorHandling(
    `${API_BASE}/auth/verify-email`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    },
    'Email verification failed'
  );
  
  
/*
  Permission Functions
*/

export const listPermissions = async () =>
  fetchWithErrorHandling(
    `${API_BASE}/permissions/list`,
    { method: 'GET' },
    'Failed to list permissions'
  );

export const checkPermissions = async (permissions, userId = 'current') =>
  fetchWithErrorHandling(
    `${API_BASE}/user/${userId}/permissions/check?permissions=${permissions.join(',')}`,
    { method: 'GET' },
    'Failed to check permissions'
  );

export const createPermission = async ({ name, resource, action, description }) =>
  fetchWithErrorHandling(
    `${API_BASE}/permissions/create`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, resource, action, description }),
    },
    'Failed to create permission'
  );

export const checkPermissionsAll = async (permissions, userId = 'current') =>
  fetchWithErrorHandling(
    `${API_BASE}/user/${userId}/permissions/check-all?permissions=${permissions.join(',')}`,
    { method: 'GET' },
    'Failed to check permissions'
  );

export const checkPermissionsSome = async (permissions, userId = 'current') =>
  fetchWithErrorHandling(
    `${API_BASE}/user/${userId}/permissions/check-some?permissions=${permissions.join(',')}`,
    { method: 'GET' },
    'Failed to check permissions'
  );