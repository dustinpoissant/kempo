import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements, ownerAc, adminAc, memberAc } from 'better-auth/plugins/organization/access';

/*
  CMS Permission Structure
*/

const cmsStatement = {
  ...defaultStatements,
  content: ['create', 'read', 'update', 'delete', 'publish'],
  page: ['create', 'read', 'update', 'delete', 'publish'],
  media: ['upload', 'read', 'update', 'delete'],
  user: ['create', 'read', 'update', 'delete'],
  comment: ['create', 'read', 'update', 'delete', 'moderate'],
  plugin: ['install', 'activate', 'configure', 'delete'],
  theme: ['install', 'activate', 'configure', 'delete'],
  settings: ['read', 'update']
};

export const ac = createAccessControl(cmsStatement);

/*
  CMS Roles
*/

export const superAdmin = ac.newRole({
  ...ownerAc.statements,
  content: ['create', 'read', 'update', 'delete', 'publish'],
  page: ['create', 'read', 'update', 'delete', 'publish'],
  media: ['upload', 'read', 'update', 'delete'],
  user: ['create', 'read', 'update', 'delete'],
  comment: ['create', 'read', 'update', 'delete', 'moderate'],
  plugin: ['install', 'activate', 'configure', 'delete'],
  theme: ['install', 'activate', 'configure', 'delete'],
  settings: ['read', 'update']
});

export const admin = ac.newRole({
  ...adminAc.statements,
  content: ['create', 'read', 'update', 'delete', 'publish'],
  page: ['create', 'read', 'update', 'delete', 'publish'],
  media: ['upload', 'read', 'update', 'delete'],
  user: ['create', 'read', 'update'],
  comment: ['create', 'read', 'update', 'delete', 'moderate'],
  settings: ['read']
});

export const editor = ac.newRole({
  ...memberAc.statements,
  content: ['create', 'read', 'update', 'delete', 'publish'],
  page: ['create', 'read', 'update', 'delete', 'publish'],
  media: ['upload', 'read', 'update', 'delete'],
  comment: ['create', 'read', 'update', 'delete', 'moderate']
});

export const contributor = ac.newRole({
  ...memberAc.statements,
  content: ['create', 'read', 'update'],
  page: ['create', 'read', 'update'],
  media: ['upload', 'read'],
  comment: ['create', 'read', 'update']
});

export const subscriber = ac.newRole({
  ...memberAc.statements,
  content: ['read'],
  page: ['read'],
  comment: ['create', 'read']
});
