import getSession from '../auth/getSession.js';
import getGuest from '../guests/getGuest.js';

/*
  Works out whose notifications a request is for, from the two tokens a browser may hold: a login session first, then
  a guest session. Resolves to [null, { userId }] or [null, { guestSessionId }], and to a 401 when the browser has
  neither, so a route can pass the result straight to any notification function.
*/
export default async ({ sessionToken, guestToken } = {}) => {
  if(sessionToken){
    const [error, found] = await getSession({ token: sessionToken });

    if(error?.code === 500){
      return [error, null];
    }

    if(found?.user){
      return [null, { userId: found.user.id }];
    }
  }

  if(guestToken){
    const [error, found] = await getGuest({ token: guestToken });

    if(error?.code === 500){
      return [error, null];
    }

    if(found){
      return [null, { guestSessionId: guestToken }];
    }
  }

  return [{ code: 401, msg: 'Authentication required' }, null];
};
