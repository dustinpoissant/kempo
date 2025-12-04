import { join } from 'path';
import { pathToFileURL } from 'url';
const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
const { auth } = authModule;

export default async (request, response) => {
  try {
    const body = await request.json();
    
    const result = await auth.api.requestPasswordReset({
      body
    });

    if(result.error) {
      return response.status(400).json({ error: result.error.message });
    }

    response.json({ success: true, message: 'Password reset email sent' });
  } catch(error) {
    console.error('Forgot password error:', error);
    response.status(500).json({ error: error.message });
  }
};
