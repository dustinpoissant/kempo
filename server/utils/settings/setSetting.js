import db from '../../db/index.js';
import { setting } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { serializeValue } from './helpers.js';
import { SECRET_MASK } from './secretCrypto.js';

export default async (owner, name, value, type = null, isPublic = false, description = null) => {
  if(!owner || !name){
    return [{ code: 400, msg: 'Both owner and name are required' }, null];
  }

  try {
    const fullName = `${owner}:${name}`;
    const detectedType = type || (typeof value === 'object' ? 'json' : typeof value);

    const [existing] = await db
      .select()
      .from(setting)
      .where(eq(setting.name, fullName))
      .limit(1);

    /*
      Secrets are never public, and the admin UI only ever shows SECRET_MASK back for an existing
      one — if that's what comes back unchanged, keep the stored ciphertext instead of encrypting
      the mask itself. A masked value with nothing to preserve (no prior secret) means the caller
      never actually supplied a new one.
    */
    let serializedValue;
    if(detectedType === 'secret'){
      isPublic = false;
      if(value === SECRET_MASK){
        if(!existing || existing.type !== 'secret'){
          return [{ code: 400, msg: 'A secret value is required' }, null];
        }
        serializedValue = existing.value;
      } else {
        serializedValue = serializeValue(value, detectedType);
      }
    } else {
      serializedValue = serializeValue(value, detectedType);
    }

    if(existing){
      await db
        .update(setting)
        .set({
          value: serializedValue,
          type: detectedType,
          isPublic,
          description,
          updatedAt: new Date()
        })
        .where(eq(setting.name, fullName));
    } else {
      await db.insert(setting).values({
        name: fullName,
        value: serializedValue,
        type: detectedType,
        isPublic,
        description,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return [null, { name: fullName, value: detectedType === 'secret' ? SECRET_MASK : value, type: detectedType, isPublic, description }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to save setting' }, null];
  }
};
