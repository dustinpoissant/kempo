import createNotification from '../notifications/createNotification.js';
import markAcknowledged from '../notifications/markAcknowledged.js';

const OWNER = 'kempo';
const DEDUPE_KEY = 'email-failing';
const ONCE_PER_MS = 60 * 60 * 1000;
const PERMISSION = 'system:emails:read';

let raisedAt = 0;

/*
  Tells the people who can read the email log that an email could not be sent and has no tries left: a password reset
  or an order confirmation that never arrived is something a person on the other end is waiting for, and the log is
  somewhere nobody looks until they are told. It is the same for every email extension, which is why kempo says it
  and not each of them.

  A banner that must be acknowledged, raised at most once an hour however many emails fail (a broken sender fails them
  all), naming the latest. `emailSent` acknowledges it when an email goes through again. Both are kept in memory: a
  restart can raise it once more, and nothing worse. Never throws: a notification problem must not turn into an email problem.
*/
export const emailFailed = async ({ type, recipient, error }) => {
  if(Date.now() - raisedAt < ONCE_PER_MS) return;
  raisedAt = Date.now();

  try {
    const [raiseError] = await createNotification({
      owner: OWNER,
      type: 'banner',
      subtype: 'error',
      mustAcknowledge: true,
      title: 'An email could not be sent',
      message: `A "${type ?? 'email'}" email to ${recipient} failed and will not be tried again: ${String(error || 'no reason was given')}`.slice(0, 500),
      permission: PERMISSION,
      dedupeKey: DEDUPE_KEY,
      actions: [{ label: 'Open the email log', href: '/admin/emails/' }],
    });
    if(raiseError) console.error(`[kempo] Could not raise the failed email notification: ${raiseError.msg}`);
  } catch(raiseError) {
    console.error(`[kempo] Could not raise the failed email notification: ${raiseError?.message ?? raiseError}`);
  }
};

export const emailSent = async () => {
  if(!raisedAt) return;
  raisedAt = 0;

  try {
    await markAcknowledged({ owner: OWNER, dedupeKey: DEDUPE_KEY });
  } catch(error) {
    console.error(`[kempo] Could not close the failed email notification: ${error?.message ?? error}`);
  }
};
