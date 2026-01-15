import logout from '../../../../../server/utils/auth/logout.js';

export default async (request, response) => {
  try {
    const result = await logout({ headers: request.headers });
    
    if(result.error){
      return response.status(400).json({ error: result.error.message || 'Sign out failed' });
    }
    
    response.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    response.json(result);
  } catch(error) {
    response.status(500).json({ error: error.message });
  }
};
