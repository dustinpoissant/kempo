import crypto from 'crypto';
import Handlebars from 'handlebars';
import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { user, verificationToken } from '../../db/schema.js';
import sendEmailFromTemplate from '../email/sendEmailFromTemplate.js';
import { getSetting } from '../settings/settings.js';

const generateToken = () => crypto.randomBytes(32).toString('hex');

export default async ({ email }) => {
  const userData = await db.select().from(user).where(eq(user.email, email)).limit(1);

  if(userData.length === 0){
    throw Object.assign(new Error('No account found with that email address'), { statusCode: 404 });
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

  const passwordResetUrlTemplate = await getSetting('system', 'password_reset_url', 'http://localhost:3000/reset-password/{{token}}');
  const compiledUrl = Handlebars.compile(passwordResetUrlTemplate);
  const resetLink = compiledUrl({ token });

  await sendEmailFromTemplate({
    to: email,
    subject: 'Reset Your Password',
    template: 'reset-password',
    data: {
      name,
      resetLink,
    },
  });

  return { success: true };
};

