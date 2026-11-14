import mergeGuest from './mergeGuest.js';
import deleteSession from '../sessions/deleteSession.js';

/*
  The step a login or registration takes once the person is verified and has a session: merge the visitor's guest into
  the account. `merged: false` is a guest that was already gone or already merged, which never stops a login. If the
  merge itself fails, the new login session is revoked so nobody is left signed in half-way, and the caller keeps the
  guest cookie so the visitor can try again.

  Resolves to [null, { merged }] and, only when the login must be refused, [{ code: 500, msg }, null].
*/
export default async ({ guestSessionId, userId, sessionToken }) => {
  if(!guestSessionId){
    return [null, { merged: false }];
  }

  const [error, result] = await mergeGuest({ guestSessionId, userId });

  if(!error){
    return [null, { merged: result.merged }];
  }

  if(error.code < 500){
    return [null, { merged: false }];
  }

  if(sessionToken){
    await deleteSession(sessionToken);
  }

  return [{ code: 500, msg: 'Could not complete the login. Please try again.' }, null];
};
