import getSetting from '../settings/getSetting.js';

/*
  How long the guest cookie lasts, from `system:guest_session_days`. It is renewed on every visit, so it is the time
  since the last one. 0 gives a cookie that goes when the browser closes. These are the options of a cookie, as plain
  data, for the HTTP layer to set.
*/
export default async () => {
  const [error, stored] = await getSetting('system', 'guest_session_days', 30);
  if(error){
    return [error, null];
  }

  let days = Number(stored);
  if(!Number.isFinite(days) || days < 0) days = 30;

  return [null, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(days > 0 ? { maxAge: Math.round(days * 24 * 60 * 60) } : {}),
  }];
};
