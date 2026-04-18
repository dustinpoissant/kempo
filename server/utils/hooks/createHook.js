import db from '../../db/index.js';
import { hook } from '../../db/schema.js';
import crypto from 'crypto';

export default async ({ owner, event, callback }) => {
  if(!owner){
    return [{ code: 400, msg: 'Owner is required' }, null];
  }
  if(!event){
    return [{ code: 400, msg: 'Event is required' }, null];
  }
  if(!callback){
    return [{ code: 400, msg: 'Callback is required' }, null];
  }

  try {
    const entry = {
      id: crypto.randomUUID(),
      owner,
      event,
      callback,
      createdAt: new Date(),
    };
    await db.insert(hook).values(entry);
    return [null, entry];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to create hook' }, null];
  }
};
