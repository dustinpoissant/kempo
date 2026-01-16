import crypto from 'crypto';
import Handlebars from 'handlebars';
import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { user, verificationToken } from '../../db/schema.js';
import sendEmailFromTemplate from '../email/sendEmailFromTemplate.js';
import getSetting from '../settings/getSetting.js';

const generateToken = () => crypto.randomBytes(32).toString('hex');

export default async ({ email }) => {
  if(!email){
    return [{ code: 400, msg: 'Email is required' }, null];
  }
  
  try {
    const userData = await db.select().from(user).where(eq(user.email, email)).limit(1);

    if(userData.length === 0){
      return [{ code: 404, msg: 'No account found with that email address' }, null];
    }

    const { id: userId, name } = userData[0];
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const now = new Date();

    await db.insert(verificationToken).values({
      token,
      userId,
      type: 'password_reset',
      expiresAt,
      createdAt: now,
    });

    const [settingError, passwordResetUrlTemplate] = await getSetting('system', 'password_reset_url', 'http://localhost:3000/reset-password/{{token}}');
    
    if(settingError){
      return [settingError, null];
    }
    
    const compiledUrl = Handlebars.compile(passwordResetUrlTemplate);
    const resetLink = compiledUrl({ token });

    const [emailError] = await sendEmailFromTemplate({
      to: email,
      subject: 'Reset Your Password',
      template: 'reset-password',
      data: {
        name,
        resetLink,
      },
    });
    
    if(emailError){
      return [emailError, null];
    }

    return [null, { success: true }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to request password reset' }, null];
  }
};

