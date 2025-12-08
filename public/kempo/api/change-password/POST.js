import { join } from 'path';
import { pathToFileURL } from 'url';

const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
const { auth } = authModule;

export default async (request, response) => {
  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if(!currentPassword || !newPassword){
      return response.status(400).json({ error: 'Current password and new password are required' });
    }

    if(newPassword.length < 8){
      return response.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const result = await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword
      },
      headers: request.headers
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
