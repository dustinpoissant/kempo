import db from '../../db/index.js';
import { setting } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { convertValue } from './helpers.js';

export default async () => {
  try {
    const results = await db
      .select()
      .from(setting)
      .where(eq(setting.isPublic, true));

    const settings = {};
    for(const s of results){
      settings[s.name] = convertValue(s.value, s.type);
    }

    return [null, settings];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve public settings' }, null];
  }
};
