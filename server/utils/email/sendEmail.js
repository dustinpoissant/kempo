import crypto from 'crypto';
import db from '../../db/index.js';
import { email } from '../../db/schema.js';
import getSenderFrom from './getSenderFrom.js';
import dispatchEmail from './dispatchEmail.js';

/*
  Asks for an email to be sent. Kempo does not send email itself: this saves the email in the log (the `email` table) and hands it to
  whichever email extension is installed (kempo-resend, kempo-smtp...) through the `email:send` hook; see dispatchEmail.js.

  `template` is the name of the template the email was made from, if any, and is its type in the log. It resolves to
  `[null, { id, status: 'sent' }]` when a sender sent it, or `[{ code, msg, emailId }, null]` when none did: 503 when there is no email
  extension installed, 502 when one tried and failed. Either way the email is in the log, and a failed one is tried again (see the
  `email_max_retries` setting).
*/
export default async ({ to, subject, html, template = null } = {}) => {
  if(!to){
    return [{ code: 400, msg: 'Recipient email is required' }, null];
  }

  if(!subject){
    return [{ code: 400, msg: 'Email subject is required' }, null];
  }

  if(!html){
    return [{ code: 400, msg: 'Email content is required' }, null];
  }

  const id = crypto.randomUUID();
  const now = new Date();
  try {
    await db.insert(email).values({ id, type: template || 'other', recipient: String(to), sender: await getSenderFrom(), subject: String(subject), html: String(html), status: 'queued', attempts: 0, createdAt: now, updatedAt: now });
  } catch(error) {
    return [{ code: 500, msg: 'The email could not be saved to send' }, null];
  }

  return dispatchEmail(id);
};
