import db from '../../db/index.js';
import { setting } from '../../db/schema.js';
import { like, not, and, sql } from 'drizzle-orm';

export default async ({ owner, limit = 50, offset = 0 } = {}) => {
  try {
    let where;
    if(owner === 'system' || owner === 'custom'){
      where = like(setting.name, `${owner}:%`);
    } else if(owner === 'extension'){
      where = and(
        not(like(setting.name, 'system:%')),
        not(like(setting.name, 'custom:%'))
      );
    }
    const q = db.select().from(setting);
    const cq = db.select({ count: sql`count(*)` }).from(setting);
    if(where){ q.where(where); cq.where(where); }
    const settings = await q.limit(limit).offset(offset);
    const [{ count }] = await cq;
    return [null, { settings, total: Number(count), limit, offset }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve settings' }, null];
  }
};
