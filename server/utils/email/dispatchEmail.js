import db from '../../db/index.js';
import { email } from '../../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';
import triggerHook from '../hooks/triggerHook.js';
import emailSettings from './emailSettings.js';
import defaultSender from './defaultSender.js';

export const SEND_HOOK = 'email:send';

/*
  One try at sending a queued email.

  The email is taken (queued -> sending, one conditional UPDATE, so of several processes only one sends it) and the `email:send`
  hook is fired with `{ email }`. Each email extension answers with what it did, and the first to say it sent it ends the chain, so
  with several installed only one sends and a failed one hands the email to the next:

    export default async ({ email }) => ({ sent: true, provider: 'my-sender', messageId: 'abc' });   // it went
    export default async ({ email }) => ({ sent: false, error: 'Mailbox full' });                    // it tried and could not (throwing says the same)
    export default async ({ email }) => ({ sent: false, skipped: true, error: 'No API key is saved' }); // it is not set up, so it did not try

  `email` is `{ id, to, from, fromIsDefault, subject, html, type, attempt }`; `fromIsDefault` says the site has not set its own sender, so
  `from` is only a placeholder and a sender that knows a better one (the mailbox it signs in with) can use that. A handler sends the email and returns; it never touches the log, which
  kempo keeps. After the chain the email is `sent`, or goes back to `queued` for a retry, or is `failed` when it has no tries left
  (the first try plus `email_max_retries`). Resolves like sendEmail.
*/
const finish = async (id, changes) => {
  const [row] = await db.update(email).set({ ...changes, updatedAt: new Date() }).where(eq(email.id, id)).returning();
  return row;
};

export default async id => {
  const [claimed] = await db.update(email)
    .set({ status: 'sending', attempts: sql`${email.attempts} + 1`, updatedAt: new Date() })
    .where(and(eq(email.id, id), eq(email.status, 'queued')))
    .returning();
  if(!claimed) return [{ code: 409, msg: 'That email is not waiting to be sent', emailId: id }, null];

  const [hookError, fired] = await triggerHook(SEND_HOOK, { email: { id: claimed.id, to: claimed.recipient, from: claimed.sender, fromIsDefault: claimed.sender === defaultSender, subject: claimed.subject, html: claimed.html, type: claimed.type, attempt: claimed.attempts } }, { stopWhen: result => result?.sent === true });
  const results = fired?.results ?? [];
  const sent = results.find(entry => entry.result?.sent === true);

  if(sent){
    await finish(id, { status: 'sent', sentAt: new Date(), lastError: null, provider: String(sent.result.provider ?? sent.owner).slice(0, 100), providerRef: sent.result.messageId ? String(sent.result.messageId).slice(0, 200) : null });
    return [null, { id, status: 'sent', provider: sent.result.provider ?? sent.owner }];
  }

  /* An extension that is not set up says so and is not counted as having tried: its reason is only shown when nothing else did. */
  const said = entry => `${entry.owner}: ${entry.error ?? entry.result?.error ?? 'did not send it'}`;
  const tried = results.filter(entry => !entry.result?.skipped);
  const reasons = hookError ? [hookError.msg] : (tried.length ? tried : results).map(said);
  const message = (tried.length || hookError ? reasons.join('; ') : results.length ? `No email extension is set up yet. ${reasons.join('; ')}` : '') || 'No email extension is installed to send email (install kempo-resend or kempo-smtp)';
  const { maxRetries } = await emailSettings();
  const final = claimed.attempts >= 1 + maxRetries;
  await finish(id, { status: final ? 'failed' : 'queued', lastError: message.slice(0, 1000) });
  return [{ code: tried.length ? 502 : 503, msg: message, emailId: id }, null];
};
