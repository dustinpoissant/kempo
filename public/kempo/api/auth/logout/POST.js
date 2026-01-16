import logout from '../../../../../server/utils/auth/logout.js';

export default async (request, response) => {
  try {
    const token = request.cookies.session_token;
    const [error, result] = await logout({ token });
    
    if(error){
      return response.status(error.code).json({ error: error.msg });
    }
    
    response.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    response.json(result);
  } catch(error) {
    response.status(500).json({ error: error.message });
  }
};
