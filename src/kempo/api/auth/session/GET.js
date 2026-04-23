import getSession from '../../../../../server/utils/auth/getSession.js';

export default async (request, response) => {
  try {
    const sessionToken = request.cookies.session_token;
    const [error, sessionData] = await getSession({ token: sessionToken });
    
    if(error || !sessionData || !sessionData.user){
      return response.json({ session: null, user: null });
    }
    
    const { passwordHash, ...userWithoutPassword } = sessionData.user;
    
    response.json({
      session: sessionData.session,
      user: userWithoutPassword
    });
  } catch(error){
    console.log('Session API error:', error);
    response.status(500).json({ error: error.message });
  }
};
