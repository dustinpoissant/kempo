import createNotification from './createNotification.js';

const OWNER = 'kempo';
const TEN_MINUTES_MS = 10 * 60 * 1000;

/*
  What kempo itself tells a person about their account. These describe something that has already happened, so a
  failure to raise one is logged and never undoes or fails the action: nobody should be unable to change a password
  because a notification could not be stored.
*/
const raise = async input => {
  try {
    const [error] = await createNotification({ owner: OWNER, ...input });
    if(error) console.error(`[kempo] Could not raise the "${input.title}" notification: ${error.msg}`);
  } catch(error) {
    console.error(`[kempo] Could not raise the "${input.title}" notification: ${error?.message ?? error}`);
  }
};

/*
  A password was changed (`reset: false`) or reset with the emailed link (`reset: true`). Two notifications: a toast
  that confirms it on whatever page the person lands on next and expires in minutes, and a notice that stays in their
  history as a record, with a way to take it back if it was not them.
*/
export const notifyPasswordChanged = async ({ userId, reset = false }) => {
  const done = reset ? 'reset' : 'changed';

  await raise({
    type: 'toast',
    subtype: 'success',
    title: `Password ${done}`,
    message: 'Your password was updated.',
    expiresAt: new Date(Date.now() + TEN_MINUTES_MS),
    userIds: [userId],
  });

  await raise({
    type: 'notice',
    subtype: 'info',
    title: `Your password was ${done}`,
    message: 'If this was not you, reset your password straight away.',
    actions: [{ label: 'Reset my password', href: '/forgot-password/' }],
    userIds: [userId],
  });
};

/*
  An email address was changed, by an administrator: a changed address is how an account is taken over, so this is a
  banner that stays until the person acknowledges it. Changing it again refreshes the same banner instead of adding another.
*/
export const notifyEmailChanged = async ({ userId, oldEmail, newEmail }) => raise({
  type: 'banner',
  subtype: 'warning',
  title: 'Your email address was changed',
  message: `It was ${oldEmail} and is now ${newEmail}. If you did not expect this, contact the site's administrators.`,
  mustAcknowledge: true,
  dedupeKey: `email-changed:${userId}`,
  actions: [{ label: 'Review my account', href: '/account/' }],
  userIds: [userId],
});
