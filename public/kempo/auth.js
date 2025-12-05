const API_BASE = '/kempo/api/auth';

/*
  Auth SDK
*/

export const register = async ({ email, password, name }) => {
  const response = await fetch(`${API_BASE}/register/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Registration failed');
  }
  
  return response.json();
};

export const login = async ({ email, password }) => {
  const response = await fetch(`${API_BASE}/login/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Login failed');
  }
  
  return response.json();
};

export const logout = async () => {
  const response = await fetch(`${API_BASE}/sign-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Logout failed');
  }
  
  return response.json();
};

export const getSession = async () => {
  const response = await fetch(`${API_BASE}/session`, {
    method: 'GET',
  });
  
  if(!response.ok) {
    if(response.status === 404) {
      return null;
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to get session');
  }
  
  return response.json();
};

export const forgotPassword = async ({ email }) => {
  const response = await fetch('/kempo/api/forgot/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Password reset request failed');
  }
  
  return response.json();
};

export const resetPassword = async ({ token, password }) => {
  const response = await fetch(`${API_BASE}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword: password }),
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Password reset failed');
  }
  
  return response.json();
};

export const verifyEmail = async ({ token }) => {
  const response = await fetch(`${API_BASE}/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Email verification failed');
  }
  
  return response.json();
};

/*
  Organization & Permission Functions
*/

export const getActiveOrganization = async () => {
  const response = await fetch(`${API_BASE}/organization/get-active`, {
    method: 'GET',
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get active organization');
  }
  
  return response.json();
};

export const getActiveMember = async () => {
  const response = await fetch(`${API_BASE}/organization/get-active-member`, {
    method: 'GET',
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get active member');
  }
  
  return response.json();
};

export const getActiveMemberRole = async () => {
  const response = await fetch(`${API_BASE}/organization/get-active-member-role`, {
    method: 'GET',
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get member role');
  }
  
  return response.json();
};

export const hasPermission = async (permissions) => {
  const response = await fetch(`${API_BASE}/organization/has-permission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions }),
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to check permission');
  }
  
  return response.json();
};

export const listMembers = async ({ limit, offset } = {}) => {
  const params = new URLSearchParams();
  if(limit) params.append('limit', limit);
  if(offset) params.append('offset', offset);
  
  const response = await fetch(`${API_BASE}/organization/list-members?${params}`, {
    method: 'GET',
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to list members');
  }
  
  return response.json();
};

export const updateMemberRole = async ({ memberId, role }) => {
  const response = await fetch(`${API_BASE}/organization/update-member-role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId, role }),
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update member role');
  }
  
  return response.json();
};

export const removeMember = async ({ memberIdOrEmail }) => {
  const response = await fetch(`${API_BASE}/organization/remove-member`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberIdOrEmail }),
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to remove member');
  }
  
  return response.json();
};

export const inviteMember = async ({ email, role }) => {
  const response = await fetch(`${API_BASE}/organization/invite-member`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to invite member');
  }
  
  return response.json();
};

/*
  Custom Permission Functions
*/

export const listPermissions = async () => {
  const response = await fetch('/kempo/api/permissions/list', {
    method: 'GET',
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to list permissions');
  }
  
  return response.json();
};

export const checkPermissions = async (permissions) => {
  const response = await fetch('/kempo/api/permissions/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions }),
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to check permissions');
  }
  
  return response.json();
};

export const createPermission = async ({ name, resource, action, description }) => {
  const response = await fetch('/kempo/api/permissions/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, resource, action, description }),
  });
  
  if(!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create permission');
  }
  
  return response.json();
};