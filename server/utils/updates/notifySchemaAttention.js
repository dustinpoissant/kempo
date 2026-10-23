import { createHash } from 'crypto';
import { and, eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification } from '../../db/schema.js';
import createNotification from '../notifications/createNotification.js';
import { getSchemaSyncResult } from '../setup/syncCoreSchema.js';
import { getReconcileResult } from '../extensions/reconcileExtensions.js';
import { PACKAGE } from './helpers.js';

/*
  After the server starts: when syncing kempo's tables left a change that the database refused, or an extension could not be
  brought up to date, tell everyone who can update kempo, once for each distinct set of problems.
  Raising the same notification at every start would mark it unread for everyone each time.
*/
export default async ({ result = getSchemaSyncResult(), extensions = getReconcileResult() } = {}) => {
  const problems = [
    ...result.failed.map(({ change, reason }) => `${change} (${reason})`),
    ...extensions.failed.map(({ name, to, reason }) => `${name} ${to} could not be brought up to date (${reason})`)
  ];
  if(!problems.length) return [null];

  const dedupeKey = `schema:${createHash('sha256').update(problems.join('\n')).digest('hex').slice(0, 16)}`;
  const [existing] = await db.select({ id: notification.id }).from(notification).where(and(eq(notification.owner, PACKAGE), eq(notification.dedupeKey, dedupeKey))).limit(1);
  if(existing) return [null];

  return createNotification({
    owner: PACKAGE,
    title: 'An update needs attention',
    message: `Kempo started, but ${problems.length === 1 ? 'one thing was' : `${problems.length} things were`} not applied: ${problems.slice(0, 3).join('; ')}${problems.length > 3 ? '; and more' : ''}.`,
    level: 'error',
    permission: 'system:updates:manage',
    dedupeKey,
    actions: [{ label: 'View details', href: '/admin/updates' }]
  });
};
