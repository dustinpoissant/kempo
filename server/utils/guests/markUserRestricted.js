import crypto from 'crypto';
import { and, eq, isNotNull } from 'drizzle-orm';
import db from '../../db/index.js';
import { guestSession, userGroup } from '../../db/schema.js';
import { RESTRICTED_GROUP } from '../setup/systemGroups.js';

/*
  Where a restricted user's restriction follows them: when the user is in the system:Restricted group, the token of a restricted
  guest record that stands for them, to put in the browser's restriction cookie (see middleware/kempo.js). The record is reused when it
  exists, so a visitor who clears their cookies does not leave a new one each time. Resolves to [null, null] for a user who is not
  restricted. The record is lifted again by `removeUserFromGroup` when the user leaves the group.
*/
export default async ({ userId }) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }

  try {
    const [member] = await db.select({ id: userGroup.id }).from(userGroup)
      .where(and(eq(userGroup.userId, userId), eq(userGroup.groupName, RESTRICTED_GROUP)))
      .limit(1);

    if(!member){
      return [null, null];
    }

    const [existing] = await db.select({ token: guestSession.token }).from(guestSession)
      .where(and(eq(guestSession.mergedIntoUserId, userId), isNotNull(guestSession.restrictedAt)))
      .limit(1);

    if(existing){
      return [null, existing.token];
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const now = new Date();
    await db.insert(guestSession).values({ token, createdAt: now, lastSeenAt: now, mergedIntoUserId: userId, mergedAt: now, restrictedAt: now });

    return [null, token];
  } catch(error){
    return [{ code: 500, msg: 'Failed to mark the restricted user' }, null];
  }
};
