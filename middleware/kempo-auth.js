import getSession from '../server/utils/auth/getSession.js';
import currentUserHasPermission from '../server/utils/permissions/currentUserHasPermission.js';

export default (config) => async (request, response, next) => {
  const { path } = request;
  if (path.startsWith('/account') || path.startsWith('/admin')) {
    const sessionToken = request.cookies.session_token;
    const [error, session] = await getSession({ token: sessionToken });
    if (error || !session || !session.user) {
      return response.redirect('/login');
    }
    if (request.path.startsWith('/admin')) {
      const [permError, hasPermission] = await currentUserHasPermission(sessionToken, 'system:admin:access');
      if (permError || !hasPermission) {
        return response.redirect('/account');
      }
    }
  }
  return next();
};
