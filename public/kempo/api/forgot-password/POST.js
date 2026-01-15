import requestPasswordReset from '../../../../server/utils/auth/requestPasswordReset.js';

export default async (request, response) => {
  try {
    const { email } = await request.json();
    
    const result = await requestPasswordReset({ email });

    if(result.error){
      return response.status(result.statusCode || 400).json({ error: result.error });
    }

    response.json({ success: true, message: 'Password reset email sent' });
  } catch(error) {
    console.error('Forgot password error:', error);
    response.status(500).json({ error: 'Failed to send password reset email' });
  }
};
