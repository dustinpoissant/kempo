import getSetting from '../settings/getSetting.js';

const DEFAULTS = { poll: 10, cooldown: 180, toast: 10, banner: 10 };

const seconds = async (name, fallback, min) => {
  const [, stored] = await getSetting('system', name, fallback);
  const value = Number(stored);
  return Number.isFinite(value) && value >= min ? value : fallback;
};

/*
  What the browser client needs to know: how often to ask for notifications, and how long a toast and a banner
  must be on screen to count as viewed. `pollSeconds` is 0 to ask only when a page loads or the window is
  focused, otherwise at least 1. `cooldownSeconds` is the default wait before a notification that must be
  acknowledged is shown again.
*/
export default async () => {
  const poll = await seconds('notification_poll_seconds', DEFAULTS.poll, 0);

  return [null, {
    pollSeconds: poll > 0 && poll < 1 ? 1 : poll,
    cooldownSeconds: await seconds('notification_cooldown_seconds', DEFAULTS.cooldown, 0),
    toastSeconds: await seconds('notification_toast_seconds', DEFAULTS.toast, 1),
    bannerSeconds: await seconds('notification_banner_seconds', DEFAULTS.banner, 1),
  }];
};
