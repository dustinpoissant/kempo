import { get, post, put, patch, del } from './fetch.js';
const API_BASE = '/kempo/api';

export const register = async ({ email, password, name }) =>
  post(`${API_BASE}/auth/register/email`, { email, password, name });

export const login = async ({ email, password }) =>
  post(`${API_BASE}/auth/login/email`, { email, password });

export const logout = async () => post(`${API_BASE}/auth/logout`, {});

export const getSession = async () => get(`${API_BASE}/auth/session`);

export const forgotPassword = async ({ email }) =>
  post(`${API_BASE}/forgot-password`, { email });

export const resetPassword = async ({ token, password, logoutAll = false }) =>
  post(`${API_BASE}/auth/reset-password`, { token, newPassword: password, logoutAll });
  
export const changePassword = async ({ currentPassword, newPassword, logoutAll }) => 
  post(`${API_BASE}/auth/change-password`, { currentPassword, newPassword, logoutAll });

export const verifyEmail = async ({ token }) =>
  post(`${API_BASE}/auth/verify-email`, { token });

export const currentUserHasPermission = async ({ permission }) =>
  get(`${API_BASE}/user/current/permissions`, { permission });

export const currentUserHasAllPermissions = async ({ permissions }) =>
  get(`${API_BASE}/user/current/permissions/all`, { permissions });

export const currentUserHasSomePermissions = async ({ permissions }) =>
  get(`${API_BASE}/user/current/permissions/some`, { permissions });

export const getAllCurrentUserPermissions = async () =>
  get(`${API_BASE}/user/current/permissions/list`);

export const userHasPermission = async ({ userid, permission }) =>
  get(`${API_BASE}/user/${userid}/permissions`, { permission });

export const userHasAllPermissions = async ({ userid, permissions }) =>
  get(`${API_BASE}/user/${userid}/permissions/all`, { permissions });

export const userHasSomePermissions = async ({ userid, permissions }) =>
  get(`${API_BASE}/user/${userid}/permissions/some`, { permissions });

export const getAllUserPermissions = async ({ userid }) =>
  get(`${API_BASE}/user/${userid}/permissions/list`);

export const getUsers = async ({ limit, offset } = {}) =>
  get(`${API_BASE}/user`, { limit, offset });

export const createUser = async ({ name, email, password, emailVerified }) =>
  post(`${API_BASE}/user/create`, { name, email, password, emailVerified });

export const deleteUsers = async (ids) =>
  del(`${API_BASE}/user`, { ids });

export const updateUser = async ({ id, name, email, emailVerified, createdAt }) =>
  patch(`${API_BASE}/user`, { id, name, email, emailVerified, createdAt });

export const getUser = async (userid) =>
  get(`${API_BASE}/user/${userid}`);

export const getUserSessions = async (userid, { limit, offset } = {}) =>
  get(`${API_BASE}/user/${userid}/sessions`, { limit, offset });

export const deleteUserSession = async (userid, sessionToken) =>
  del(`${API_BASE}/user/${userid}/sessions`, { sessionToken });

export const deleteExpiredUserSessions = async (userid) =>
  del(`${API_BASE}/user/${userid}/sessions/expired`);

export const getUserGroups = async (userid, { limit, offset } = {}) =>
  get(`${API_BASE}/user/${userid}/groups`, { limit, offset });

export const addUserToGroup = async (userid, groupName) =>
  post(`${API_BASE}/user/${userid}/groups`, { groupName });

export const removeUserFromGroup = async (userid, groupName) =>
  del(`${API_BASE}/user/${userid}/groups`, { groupName });

export const listGroups = async ({ limit, offset, owner } = {}) =>
  get(`${API_BASE}/groups`, { limit, offset, owner });

export const createGroup = async ({ name, description }) =>
  post(`${API_BASE}/groups`, { name, description });

export const updateGroup = async ({ name, description, owner }) =>
  patch(`${API_BASE}/groups`, { name, description, owner });

export const deleteGroups = async (names) =>
  del(`${API_BASE}/groups`, { names });

export const getGroup = async (name) =>
  get(`${API_BASE}/groups/${encodeURIComponent(name)}`);

export const getGroupMembers = async (name, { limit, offset } = {}) =>
  get(`${API_BASE}/groups/${encodeURIComponent(name)}/members`, { limit, offset });

export const addMemberToGroup = async (name, userId) =>
  post(`${API_BASE}/groups/${encodeURIComponent(name)}/members`, { userId });

export const removeMemberFromGroup = async (name, userId) =>
  del(`${API_BASE}/groups/${encodeURIComponent(name)}/members`, { userId });

export const getGroupPermissions = async (name) =>
  get(`${API_BASE}/groups/${encodeURIComponent(name)}/permissions`);

export const listPermissions = async ({ limit, offset, owner } = {}) =>
  get(`${API_BASE}/permissions`, { limit, offset, owner });

export const createPermissions = async (permissions) =>
  post(`${API_BASE}/permissions`, { permissions });

export const updatePermission = async ({ name, description }) =>
  patch(`${API_BASE}/permissions`, { name, description });

export const deletePermissions = async (names) =>
  del(`${API_BASE}/permissions`, { names });

export const getSetting = async (owner, name) =>
  get(`${API_BASE}/settings/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);

export const listSettings = async ({ owner, limit, offset } = {}) =>
  get(`${API_BASE}/settings/${encodeURIComponent(owner)}`, { limit, offset });

export const setSetting = async (owner, name, data) =>
  post(`${API_BASE}/settings/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, data);

export const deleteSetting = async (owner, name) =>
  del(`${API_BASE}/settings/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);

/*
  Pages
*/

export const listPages = async () =>
  get(`${API_BASE}/pages`);

export const listTemplates = async () =>
  get(`${API_BASE}/templates`);

export const listDirectories = async () =>
  get(`${API_BASE}/pages/directories`);

export const getPage = async (file) =>
  get(`${API_BASE}/pages/file`, { file });

export const createPage = async ({ directory, name, template }) =>
  post(`${API_BASE}/pages`, { directory, name, template });

export const updatePage = async ({ file, name, title, description, author, template, contents }) =>
  put(`${API_BASE}/pages/file`, { file, name, title, description, author, template, contents });

export const deletePages = async (files) =>
  del(`${API_BASE}/pages`, { files });

export const movePage = async ({ file, newFile }) =>
  patch(`${API_BASE}/pages/file`, { file, newFile });

/*
  Templates
*/

export const getTemplate = async (file) =>
  get(`${API_BASE}/templates/file`, { file });

export const createTemplate = async ({ directory, name, copyFrom }) =>
  post(`${API_BASE}/templates`, { directory, name, copyFrom });

export const updateTemplate = async ({ file, name, author, markup }) =>
  put(`${API_BASE}/templates/file`, { file, name, author, markup });

export const deleteTemplates = async (files) =>
  del(`${API_BASE}/templates`, { files });

/*
  Menus
*/

export const listMenus = async ({ owner, limit, offset } = {}) => {
  const params = {};
  if(owner) params.owner = owner;
  if(limit) params.limit = limit;
  if(offset) params.offset = offset;
  return get(`${API_BASE}/menus`, params);
};

export const getMenu = async (id) =>
  get(`${API_BASE}/menus/${encodeURIComponent(id)}`);

export const getMenuBySlug = async (slug) =>
  get(`${API_BASE}/menus/by-slug`, { slug });

export const createMenu = async (data) =>
  post(`${API_BASE}/menus`, data);

export const updateMenu = async (data) =>
  patch(`${API_BASE}/menus`, data);

export const deleteMenus = async (ids) =>
  del(`${API_BASE}/menus`, { ids });

export const addMenuItem = async (menuId, data) =>
  post(`${API_BASE}/menus/${encodeURIComponent(menuId)}/items`, data);

export const updateMenuItem = async (menuId, data) =>
  patch(`${API_BASE}/menus/${encodeURIComponent(menuId)}/items`, data);

export const deleteMenuItems = async (menuId, ids) =>
  del(`${API_BASE}/menus/${encodeURIComponent(menuId)}/items`, { ids });

/*
  Fragments
*/

export const listFragments = async () =>
  get(`${API_BASE}/fragments`);

export const getFragment = async (file) =>
  get(`${API_BASE}/fragments/file`, { file });

export const createFragment = async ({ directory, name }) =>
  post(`${API_BASE}/fragments`, { directory, name });

export const updateFragment = async ({ file, name, author, markup }) =>
  put(`${API_BASE}/fragments/file`, { file, name, author, markup });

export const deleteFragments = async (files) =>
  del(`${API_BASE}/fragments`, { files });

/*
  Global Content
*/

export const listGlobalContent = async () =>
  get(`${API_BASE}/globals`);

export const getGlobalContent = async (id) =>
  get(`${API_BASE}/globals/entry`, { id });

export const createGlobalContent = async ({ name, location, priority }) =>
  post(`${API_BASE}/globals`, { name, location, priority });

export const updateGlobalContent = async ({ id, name, location, priority, markup }) =>
  put(`${API_BASE}/globals/entry`, { id, name, location, priority, markup });

export const deleteGlobalContent = async (ids) =>
  del(`${API_BASE}/globals`, { ids });
