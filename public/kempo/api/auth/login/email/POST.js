import loginEmail from '../../../../../../server/utils/auth/loginEmail.js';

export default async (request, response) => {
  try {
    const { email, password } = await request.json();
    
    const result = await loginEmail({ email, password });
    
    if(result.error){
      return response.status(400).json({ error: result.error });
    }

    response.cookie('session_token', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: result.expiresAt.getTime() - Date.now()
    });
    
    response.json({ user: result.user });
  } catch(error) {
    console.error('Login error:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
};
