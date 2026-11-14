import isGuestRestricted from './isGuestRestricted.js';

/*
  Whether a visitor is restricted, from the two tokens the HTTP layer reads out of their cookies: the guest's own (`guestToken`) and the
  one in the restriction cookie (`restrictedToken`), which outlives it. Either one restricted is enough. A visitor with neither is not.
*/
export default async ({ guestToken, restrictedToken } = {}) => {
  for(const token of [guestToken, restrictedToken]){
    if(!token) continue;
    const [error, restricted] = await isGuestRestricted({ token });
    if(error) return [error, null];
    if(restricted) return [null, true];
  }
  return [null, false];
};
