import crypto from 'crypto';
import Handlebars from 'handlebars';
import db from '../../db/index.js';
import { verificationToken } from '../../db/schema.js';
import sendEmailFromTemplate from '../email/sendEmailFromTemplate.js';
import getSetting from '../settings/getSetting.js';

const generateToken = () => crypto.randomBytes(32).toString('hex');

export default async ({ userId, email, name }) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  if(!email){
    return [{ code: 400, msg: 'Email is required' }, null];
  }
  
  try {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const now = new Date();

    await db.insert(verificationToken).values({
      token,
      userId,
      type: 'email_verification',
      expiresAt,
      createdAt: now,
    });

    const [settingError, verificationUrlTemplate] = await getSetting('system', 'verification_url', 'http://localhost:3000/verify-email/{{token}}');
    
    if(settingError){
      return [settingError, null];
    }
    
    const compiledUrl = Handlebars.compile(verificationUrlTemplate);
    const verificationLink = compiledUrl({ token });

    const [emailError] = await sendEmailFromTemplate({
      to: email,
      subject: 'Verify Your Email Address',
      template: 'verify-email',
      data: {
        name,
        verificationLink,
      },
    });
    
    if(emailError){
      return [emailError, null];
    }

    return [null, { success: true }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to send verification email' }, null];
  }
};
