import db from '../../db/index.js';
import { setting } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { convertValue } from './helpers.js';
import { SECRET_MASK } from './secretCrypto.js';

export default async (owner, name) => {
  if(!owner || !name){
    return [{ code: 400, msg: 'Both owner and name are required' }, null];
  }

  try {
    const fullName = `${owner}:${name}`;
    const [result] = await db
      .select()
      .from(setting)
      .where(eq(setting.name, fullName))
      .limit(1);

    if(!result) return [{ code: 404, msg: 'Setting not found' }, null];

    /*
      This feeds the HTTP API (GET /kempo/api/settings/[owner]/[name]) — the decrypted value must
      never travel over the wire, so a secret is masked here rather than passed through convertValue.
    */
    return [null, {
      name: result.name,
      value: result.type === 'secret'
        ? (result.value === null ? null : SECRET_MASK)
        : convertValue(result.value, result.type),
      type: result.type,
      isPublic: result.isPublic,
      description: result.description,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve setting' }, null];
  }
};
