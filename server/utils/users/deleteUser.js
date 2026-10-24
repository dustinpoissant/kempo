import db from '../../db/index.js';
import { user, session, verificationToken, userGroup } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import triggerHook from '../hooks/triggerHook.js';

/*
  Deletes a user and everything kempo keeps for them: their sessions, codes, group memberships and the
  account itself. Then fires `user:deleted` with `{ id, email, name }` so every extension can remove what it
  keeps about that person. Those extensions own their own data; kempo only tells them.

  The hook runs after the user has gone, and a handler that fails does not undo the deletion: the
  notification contract keeps going and records the failure.
*/
export default async (id) => {
  if(!id){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }

  let removed = null;
  try {
    const [existing] = await db.select({ id: user.id, email: user.email, name: user.name }).from(user).where(eq(user.id, id)).limit(1);
    removed = existing ?? null;

    await db.delete(session).where(eq(session.userId, id));
    await db.delete(verificationToken).where(eq(verificationToken.userId, id));
    await db.delete(userGroup).where(eq(userGroup.userId, id));
    await db.delete(user).where(eq(user.id, id));
  } catch(error){
    return [{ code: 500, msg: 'Failed to delete user' }, null];
  }

  if(removed){
    await triggerHook('user:deleted', { id: removed.id, email: removed.email, name: removed.name });
  }

  return [null, { id }];
};
