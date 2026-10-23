import { createHash } from 'crypto';
import { and, eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification } from '../../db/schema.js';
import getSetting from '../settings/getSetting.js';
import createNotification from '../notifications/createNotification.js';
import getUpdateStatus from './getUpdateStatus.js';
import { PACKAGE } from './helpers.js';

/*
  Raising a notification again would mark it unread for everyone, so each one has a key that names what it is about, and
  one that already exists is left alone: one for each new version of kempo, and one for each distinct set of extension
  updates that are waiting.
*/
const raiseOnce = async ({ dedupeKey, ...notice }) => {
  const [existing] = await db.select({ id: notification.id }).from(notification).where(and(eq(notification.owner, PACKAGE), eq(notification.dedupeKey, dedupeKey))).limit(1);
  if(existing) return;
  const [error] = await createNotification({ owner: PACKAGE, permission: 'system:updates:manage', dedupeKey, actions: [{ label: 'View updates', href: '/admin/updates' }], ...notice });
  if(error) console.error(`[kempo] Update notification: ${error.msg}`);
};

/*
  The scheduled check (kempo's `update-check` job). Asks npm for the newest version of kempo and of every installed extension
  and tells everyone who can install them what is waiting, once for each new version of kempo and once for each distinct set
  of extension updates. Nothing is said about a site that cannot install updates (a linked checkout). The
  `system:update_check_enabled` setting turns this off.
*/
export default async ({ fetcher, install } = {}) => {
  const [, enabled] = await getSetting('system', 'update_check_enabled', true);
  if(enabled === false) return;

  const [, status] = await getUpdateStatus({ force: true, fetcher, install });
  if(!status?.canUpdate) return;

  if(status.updateAvailable){
    await raiseOnce({
      dedupeKey: `update:${status.latestVersion}`,
      title: `Kempo ${status.latestVersion} is available`,
      message: `This site runs ${status.runningVersion}.${status.major ? ' This is a major release and may include breaking changes.' : ''}`
    });
  }

  const { updates } = status.extensionUpdates;
  if(updates.length){
    const list = updates.map(update => `${update.name}@${update.latestVersion}`);
    await raiseOnce({
      dedupeKey: `extension-updates:${createHash('sha256').update(list.join('\n')).digest('hex').slice(0, 16)}`,
      title: updates.length === 1 ? `${updates[0].name} ${updates[0].latestVersion} is available` : `${updates.length} extension updates are available`,
      message: `${updates.slice(0, 5).map(update => `${update.name} ${update.installedVersion} -> ${update.latestVersion}${update.major ? ' (major)' : ''}`).join(', ')}${updates.length > 5 ? ', and more' : ''}.`
    });
  }
};
