import getSession from '../auth/getSession.js';
import getUserGroups from '../permissions/getUserGroups.js';
import getPermissionsForGroups from '../permissions/getPermissionsForGroups.js';
import evaluatePermissionExpression from '../permissions/evaluatePermissionExpression.js';

/*
  Decides whether a person may see a page, from the page's frontmatter:

    require-login: true                       they must be signed in
    require-permissions: a || (b && c)        they must satisfy the expression (this implies signed in)
    permission-denied-redirect: /somewhere    where a signed-in person without the permissions is sent
    login-required-redirect: /somewhere      where a person who is not signed in is sent (the caller's login page when unset)

  Resolves to [null, { allowed: true }] or [null, { allowed: false, reason, redirect }], where `reason` is
  'login' (not signed in) or 'permission' (signed in, but not allowed); `redirect` is the page's own redirect for that
  reason, or null. A page with none of the keys never
  touches the database. An expression that cannot be read is an error, so the caller can refuse the page
  rather than show it.
*/
export default async ({ token, meta = {} }) => {
  const expression = meta['require-permissions'];

  if(meta['require-login'] !== 'true' && !expression){
    return [null, { allowed: true }];
  }

  const [sessionError, sessionData] = token ? await getSession({ token }) : [true, null];

  if(sessionError || !sessionData?.user){
    return [null, { allowed: false, reason: 'login', redirect: meta['login-required-redirect'] || null }];
  }

  if(!expression){
    return [null, { allowed: true }];
  }

  const [groupsError, groups] = await getUserGroups(sessionData.user.id);

  if(groupsError){
    return [groupsError, null];
  }

  const [permissionsError, permissions] = await getPermissionsForGroups(groups);

  if(permissionsError){
    return [permissionsError, null];
  }

  const [expressionError, satisfied] = evaluatePermissionExpression({
    expression,
    permissions,
    isAdmin: groups.some(group => group.name === 'system:Administrators')
  });

  if(expressionError){
    return [expressionError, null];
  }

  return [null, satisfied
    ? { allowed: true }
    : { allowed: false, reason: 'permission', redirect: meta['permission-denied-redirect'] || null }];
};
