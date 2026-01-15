import getSession from '../server/utils/auth/getSession.js';
import currentUserHasPermission from '../server/utils/permissions/currentUserHasPermission.js';

export default (config) => async (request, response, next) => {
  const { path } = request;
  if (path.startsWith('/account') || path.startsWith('/admin')) {
    const sessionToken = request.cookies.session_token;
    const session = await getSession({ token: sessionToken });
    if (!session || !session.user) {
      return response.redirect('/login');
    }
    if (request.path.startsWith('/admin')) {
      if (!await currentUserHasPermission(sessionToken, 'system:admin:access')) {
        return response.redirect('/account');
      }
    }
  }
  return next();
};
