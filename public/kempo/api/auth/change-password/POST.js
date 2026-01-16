import changePassword from '../../../../../server/utils/auth/changePassword.js';
import getSession from '../../../../../server/utils/auth/getSession.js';
import bcrypt from 'bcrypt';

export default async (request, response) => {
  try {
    const sessionToken = request.cookies.session_token;
    const [sessionError, session] = await getSession({ token: sessionToken });
    
    if(sessionError || !session || !session.user){
      return response.status(401).json({ error: 'Not authenticated' });
    }
    
    const { currentPassword, newPassword } = await request.json();

    if(!currentPassword || !newPassword){
      return response.status(400).json({ error: 'Current password and new password are required' });
    }

    if(newPassword.length < 8){
      return response.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const isValid = await bcrypt.compare(currentPassword, session.user.passwordHash);
    
    if(!isValid){
      return response.status(400).json({ error: 'Current password is incorrect' });
    }

    const [changeError, result] = await changePassword({
      userId: session.user.id,
      newPassword
    });

    if(changeError){
      return response.status(changeError.code).json({ error: changeError.msg });
    }

    response.json({ success: true, message: 'Password changed successfully' });
  } catch(error){
    console.error('Change password error:', error);
    response.status(500).json({ 
      error: error.message || 'Failed to change password'
    });
  }
};
