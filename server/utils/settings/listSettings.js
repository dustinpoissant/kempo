import db from '../../db/index.js';
import { setting } from '../../db/schema.js';
import { like, not, and, asc, sql } from 'drizzle-orm';
import { SECRET_MASK } from './secretCrypto.js';

/*
  The settings of one owner, by name. `owner` is 'system', 'custom', 'extension' (every setting that is neither, whoever owns it),
  or the name of one extension (`kempo-commerce`), which lists just its own. The owner is matched as a plain prefix, never as a
  pattern, so a name with `_` or `%` in it cannot reach another owner's settings.
*/
export default async ({ owner, limit = 50, offset = 0 } = {}) => {
  try {
    let where;
    if(owner === 'extension'){
      where = and(
        not(like(setting.name, 'system:%')),
        not(like(setting.name, 'custom:%'))
      );
    } else if(owner){
      where = sql`left(${setting.name}, ${owner.length + 1}) = ${`${owner}:`}`;
    }
    const q = db.select().from(setting);
    const cq = db.select({ count: sql`count(*)` }).from(setting);
    if(where){ q.where(where); cq.where(where); }
    const results = await q.orderBy(asc(setting.name)).limit(limit).offset(offset);
    const [{ count }] = await cq;

    // Never send secret ciphertext to the admin UI, not even encrypted.
    const settings = results.map(s => s.type === 'secret'
      ? { ...s, value: s.value === null ? null : SECRET_MASK }
      : s
    );

    return [null, { settings, total: Number(count), limit, offset }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve settings' }, null];
  }
};
