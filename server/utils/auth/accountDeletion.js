import crypto from 'crypto';
import { and, count, eq, gt, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { user, userGroup, verificationToken } from '../../db/schema.js';
import sendEmailFromTemplate from '../email/sendEmailFromTemplate.js';
import deleteUser from '../users/deleteUser.js';

/*
  A person deletes their own account. No login is needed: they give the email address on the account,
  and a six-digit code is sent there. Typing the code back proves they control that mailbox, and only then
  is the account deleted. Someone who does not hold the mailbox can request codes for it but cannot use them.

  Nothing in the answer tells a stranger whether an account exists for an address: the same reply comes back
  either way, and the email is sent only when there is an account to delete.
*/

const CODE_MINUTES = 30;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60 * 1000;
const TYPE = 'account_deletion';
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const tokenFor = (userId, code) => `${TYPE}:${crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex')}`;

const normalised = email => String(email ?? '').trim().toLowerCase();

const accountFor = async email => {
  const [found] = await db.select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`)
    .limit(1);
  return found ?? null;
};

/*
  Sends a code to the account for `email`, if there is one. Always answers the same way.
*/
export const requestAccountDeletion = async ({ email, now = new Date() }) => {
  const address = normalised(email);
  if(!EMAIL_PATTERN.test(address)){
    return [{ code: 400, msg: 'Enter the email address on your account' }, null];
  }

  const found = await accountFor(address);
  if(!found) return [null, { sent: true }];

  const [recent] = await db.select({ createdAt: verificationToken.createdAt }).from(verificationToken)
    .where(and(eq(verificationToken.userId, found.id), eq(verificationToken.type, TYPE)))
    .limit(1);
  if(recent && now - recent.createdAt < COOLDOWN_MS) return [null, { sent: true }];

  await db.delete(verificationToken).where(and(eq(verificationToken.userId, found.id), eq(verificationToken.type, TYPE)));

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await db.insert(verificationToken).values({
    token: tokenFor(found.id, code),
    userId: found.id,
    type: TYPE,
    expiresAt: new Date(now.getTime() + CODE_MINUTES * 60 * 1000),
    attempts: 0,
    createdAt: now,
  });

  const [mailError] = await sendEmailFromTemplate({
    to: found.email,
    subject: 'Your code to delete your account',
    template: 'account-deletion-code',
    data: { name: found.name || '', code, minutes: CODE_MINUTES },
  });
  // Saved in the email log and sent when a sender is ready, so that still counts as sent.
  if(mailError && !mailError.emailId){
    await db.delete(verificationToken).where(eq(verificationToken.token, tokenFor(found.id, code)));
    return [{ code: 502, msg: 'The email could not be sent right now. Try again in a minute' }, null];
  }

  return [null, { sent: true }];
};

/*
  Checks the code and, if it is right, deletes the account. A wrong code counts as an attempt; after
  MAX_ATTEMPTS the code is dead and a new one has to be asked for.
*/
export const confirmAccountDeletion = async ({ email, code, now = new Date() }) => {
  const address = normalised(email);
  const given = String(code ?? '').replace(/\s/g, '');
  const wrong = [{ code: 400, msg: 'That code is not right' }, null];

  const found = await accountFor(address);
  if(!found || !/^\d{6}$/.test(given)) return wrong;

  const [row] = await db.select().from(verificationToken)
    .where(and(eq(verificationToken.userId, found.id), eq(verificationToken.type, TYPE)))
    .limit(1);
  if(!row) return [{ code: 400, msg: 'No code has been sent for this account. Ask for a new one' }, null];
  if(row.expiresAt < now) return [{ code: 400, msg: 'That code has expired. Ask for a new one' }, null];
  if(row.attempts >= MAX_ATTEMPTS) return [{ code: 429, msg: 'Too many wrong tries. Ask for a new code' }, null];

  if(row.token !== tokenFor(found.id, given)){
    await db.update(verificationToken).set({ attempts: row.attempts + 1 }).where(eq(verificationToken.token, row.token));
    return wrong;
  }

  /*
    The last administrator cannot delete themselves: the site would be left with nobody who can run it.
  */
  const [admin] = await db.select({ userId: userGroup.userId }).from(userGroup)
    .where(eq(userGroup.groupName, 'system:Administrators'))
    .limit(1);
  if(admin?.userId === found.id){
    const [{ total }] = await db.select({ total: count() }).from(userGroup).where(eq(userGroup.groupName, 'system:Administrators'));
    if(Number(total) <= 1){
      return [{ code: 409, msg: 'You are the only administrator, so this account cannot be deleted. Make someone else an administrator first' }, null];
    }
  }

  const [deleteError] = await deleteUser(found.id);
  if(deleteError) return [deleteError, null];

  return [null, { deleted: true }];
};
