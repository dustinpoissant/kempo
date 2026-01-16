import requestPasswordReset from '../../../../server/utils/auth/requestPasswordReset.js';

export default async (request, response) => {
  try {
    const { email } = await request.json();
    
    const [error, result] = await requestPasswordReset({ email });

    if(error){
      return response.status(error.code).json({ error: error.msg });
    }

    response.json({ success: true, message: 'Password reset email sent' });
  } catch(error){
    console.error('Forgot password error:', error);
    response.status(500).json({ error: 'Failed to send password reset email' });
  }
};
