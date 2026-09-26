import { and, eq, lt, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { realtimeMessage, realtimeChannel } from '../../db/schema.js';
import { resolveChannel, DEFAULT_RETENTION_MS } from './channels.js';

/*
  Deletes persisted messages older than their channel's retention and records how far each channel has
  been pruned, which is what lets a client that asks for a `since` below that point be told it missed
  messages instead of quietly getting an incomplete history.

  A channel that can no longer be resolved (its extension was uninstalled or disabled) falls back to
  the default retention, so orphaned rows still age out.
*/
export default async ({ now = new Date() } = {}) => {
  try {
    const rows = await db.selectDistinct({ channel: realtimeMessage.channel }).from(realtimeMessage);
    let deleted = 0;

    for(const { channel } of rows){
      const config = await resolveChannel(channel);
      const cutoff = new Date(now.getTime() - (config?.retentionMs ?? DEFAULT_RETENTION_MS));

      const removed = await db
        .delete(realtimeMessage)
        .where(and(eq(realtimeMessage.channel, channel), lt(realtimeMessage.createdAt, cutoff)))
        .returning({ id: realtimeMessage.id });

      if(!removed.length) continue;
      deleted += removed.length;

      const prunedThrough = Math.max(...removed.map(row => row.id));
      await db
        .insert(realtimeChannel)
        .values({ channel, prunedThrough })
        .onConflictDoUpdate({
          target: realtimeChannel.channel,
          set: { prunedThrough: sql`greatest(${realtimeChannel.prunedThrough}, ${prunedThrough})` }
        });
    }

    return [null, { deleted }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to prune realtime messages' }, null];
  }
};
