import db from '../../db/index.js';
import { setting } from '../../db/schema.js';
import { eq, and, ne } from 'drizzle-orm';
import { convertValue } from './helpers.js';

export default async () => {
  try {
    // isPublic should never be true on a secret (setSetting forces it false), but this is the
    // one unauthenticated endpoint in the settings system, so exclude 'secret' defensively too.
    const results = await db
      .select()
      .from(setting)
      .where(and(eq(setting.isPublic, true), ne(setting.type, 'secret')));

    const settings = {};
    for(const s of results){
      settings[s.name] = convertValue(s.value, s.type);
    }

    return [null, settings];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve public settings' }, null];
  }
};
