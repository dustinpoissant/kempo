import resetPassword from '../../../../../server/utils/auth/resetPassword.js';
import loginEmail from '../../../../../server/utils/auth/loginEmail.js';
import db from '../../../../../server/db/index.js';
import { user } from '../../../../../server/db/schema.js';
import { eq } from 'drizzle-orm';

export default async (request, response) => {
  try {
    const { token, newPassword, logoutAll = false } = await request.json();
    
    console.log('Password reset request - Token:', token);
    
    const result = await resetPassword({ token, password: newPassword, logoutAll });
    
    const userData = await db.select().from(user).where(eq(user.id, result.userId)).limit(1);
    
    if(userData.length === 0){
      return response.status(500).json({ error: 'User not found after password reset' });
    }

    const loginResult = await loginEmail({ email: userData[0].email, password: newPassword });
    
    response.cookie('session_token', loginResult.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: (loginResult.sessionDurationDays || 7) * 24 * 60 * 60 * 1000
    });
    
    response.json({ success: true, user: loginResult.user });
  } catch(error) {
    response.status(error.statusCode || 500).json({ error: error.message });
  }
};
