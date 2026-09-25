import { sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { realtimeMessage } from '../../db/schema.js';
import { resolveChannel } from './channels.js';
import { BUS_CHANNEL, MAX_INLINE_BYTES, MAX_PERSISTED_BYTES, LOCK_PREFIX } from './constants.js';

/*
  Every message travels through Postgres NOTIFY, including to subscribers held by this same process,
  so there is a single delivery path and a publish behaves the same whichever process it runs in.

  A channel that persists writes the message to a table first and notifies with only its id. The row
  and the notification are one transaction, and NOTIFY is delivered on commit, so no listener can be
  told about a row it cannot yet read. The transaction also takes a lock keyed on the channel: ids are
  handed out at insert but become visible at commit, so without it two publishes could commit out of
  order and a client replaying from the earlier id would skip the later-committing row for good.
*/
export default async ({ channel, data } = {}) => {
  if(!channel){
    return [{ code: 400, msg: 'Channel is required' }, null];
  }
  if(data === undefined || data === null){
    return [{ code: 400, msg: 'Data is required' }, null];
  }

  const config = await resolveChannel(channel);
  if(!config){
    return [{ code: 404, msg: `Channel "${channel}" is not registered` }, null];
  }

  let serialized;
  try {
    serialized = JSON.stringify(data);
  } catch(error) {
    return [{ code: 400, msg: 'Data must be JSON-serializable' }, null];
  }
  if(serialized === undefined){
    return [{ code: 400, msg: 'Data must be JSON-serializable' }, null];
  }

  if(config.persist){
    if(Buffer.byteLength(serialized) > MAX_PERSISTED_BYTES){
      return [{ code: 413, msg: `Message is larger than the ${MAX_PERSISTED_BYTES} byte limit` }, null];
    }

    try {
      const id = await db.transaction(async transaction => {
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${LOCK_PREFIX + channel}))`);
        const [row] = await transaction
          .insert(realtimeMessage)
          .values({ channel, data, createdAt: new Date() })
          .returning({ id: realtimeMessage.id });
        await transaction.execute(sql`select pg_notify(${BUS_CHANNEL}, ${JSON.stringify({ c: channel, i: row.id })})`);
        return row.id;
      });
      return [null, { id }];
    } catch(error) {
      return [{ code: 500, msg: 'Failed to publish message' }, null];
    }
  }

  const payload = JSON.stringify({ c: channel, d: data });
  if(Buffer.byteLength(payload) > MAX_INLINE_BYTES){
    return [{ code: 413, msg: `Message is too large for a channel that does not persist (limit ${MAX_INLINE_BYTES} bytes); send less, or register the channel with persist: true` }, null];
  }

  try {
    await db.execute(sql`select pg_notify(${BUS_CHANNEL}, ${payload})`);
    return [null, { id: null }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to publish message' }, null];
  }
};
