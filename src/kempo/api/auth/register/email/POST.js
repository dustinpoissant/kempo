import registerEmail from '../../../../../../server/utils/auth/registerEmail.js';
import mergeGuestIntoLogin from '../../../../../../server/utils/guests/mergeGuestIntoLogin.js';
import { GUEST_COOKIE } from '../../../../../../server/utils/guests/constants.js';

export default async (request, response) => {
  try {
    const { email, password, name } = request.body;
    
    const [error, result] = await registerEmail({ email, password, name });
    
    if(error){
      return response.status(error.code).json({ error: error.msg });
    }

    if(result.requiresVerification){
      return response.json({ user: result.user, requiresVerification: result.requiresVerification });
    }

    const guestToken = request.cookies?.[GUEST_COOKIE];
    const [mergeError] = await mergeGuestIntoLogin({ guestSessionId: guestToken, userId: result.user.id, sessionToken: result.sessionToken });
    if(mergeError){
      return response.status(mergeError.code).json({ error: mergeError.msg });
    }
    if(guestToken){
      response.clearCookie(GUEST_COOKIE, { path: '/' });
    }

    response.cookie('session_token', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: result.expiresAt.getTime() - Date.now()
    });
    
    response.json({ user: result.user });
  } catch(error){
    console.error('Registration error:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
};
