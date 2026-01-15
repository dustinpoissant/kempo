import crypto from 'crypto';
import Handlebars from 'handlebars';
import db from '../../db/index.js';
import { verificationToken } from '../../db/schema.js';
import sendEmailFromTemplate from '../email/sendEmailFromTemplate.js';
import { getSetting } from '../settings/settings.js';

const generateToken = () => crypto.randomBytes(32).toString('hex');

export default async ({ userId, email, name }) => {
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

  const verificationUrlTemplate = await getSetting('system', 'verification_url', 'http://localhost:3000/verify-email/{{token}}');
  const compiledUrl = Handlebars.compile(verificationUrlTemplate);
  const verificationLink = compiledUrl({ token });

  await sendEmailFromTemplate({
    to: email,
    subject: 'Verify Your Email Address',
    template: 'verify-email',
    data: {
      name,
      verificationLink,
    },
  });

  return { success: true };
};
