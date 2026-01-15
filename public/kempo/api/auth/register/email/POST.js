import registerEmail from '../../../../../../server/utils/auth/registerEmail.js';

export default async (request, response) => {
  try {
    const { email, password, name } = await request.json();
    
    const {
      error,
      statusCode,
      requiresVerification,
      user,
      sessionToken,
      expiresAt 
    } = await registerEmail({ email, password, name });
    
    if(error){
      return response.status(statusCode || 400).json({ error });
    }

    if(requiresVerification){ // No sessionToken was created by the registerEmail util, return early
      return response.json({ user, requiresVerification });
    }

    response.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expiresAt.getTime() - Date.now()
    });
    
    response.json({ user });
  } catch(error) {
    console.error('Registration error:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
};
