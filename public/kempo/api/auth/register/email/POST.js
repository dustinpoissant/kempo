import registerEmail from '../../../../../../server/utils/auth/registerEmail.js';

export default async (request, response) => {
  try {
    const { email, password, name } = await request.json();
    
    const [error, result] = await registerEmail({ email, password, name });
    
    if(error){
      return response.status(error.code).json({ error: error.msg });
    }

    if(result.requiresVerification){
      return response.json({ user: result.user, requiresVerification: result.requiresVerification });
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
