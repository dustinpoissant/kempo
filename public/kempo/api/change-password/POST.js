import changePassword from '../../../../server/utils/auth/changePassword.js';
import getSession from '../../../../server/utils/auth/getSession.js';
import bcrypt from 'bcrypt';

export default async (request, response) => {
  try {
    const sessionToken = request.cookies.session_token;
    const session = await getSession({ token: sessionToken });
    
    if(!session || !session.user){
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

    const result = await changePassword({
      userId: session.user.id,
      newPassword
    });

    if(result.error){
      console.error('Change password error:', result.error);
      return response.status(400).json({ 
        error: result.error.message || 'Failed to change password'
      });
    }

    if(!result || result.status === false){
      console.error('Change password failed:', result);
      return response.status(500).json({ 
        error: 'Failed to change password' 
      });
    }

    response.json({ success: true, message: 'Password changed successfully' });
  } catch(error){
    console.error('Change password error:', error);
    response.status(500).json({ 
      error: error.message || 'Failed to change password'
    });
  }
};
