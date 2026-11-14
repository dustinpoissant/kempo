export const GUEST_COOKIE = 'kempo_guest';

/* Marks a browser whose guest was restricted. Its value is that guest's token, and it outlives the guest cookie. */
export const RESTRICTED_COOKIE = 'kempo_restricted';

export const RESTRICTED_COOKIE_SECONDS = 365 * 24 * 60 * 60;

/* A visit more recent than this does not write the guest's last-seen time again. */
export const TOUCH_INTERVAL_MS = 60 * 1000;
