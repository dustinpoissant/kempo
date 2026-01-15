import crypto from 'crypto';
import db from '../../db/index.js';
import { userGroup } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

export default async (userId, groupName) => {
  const [existing] = await db
    .select()
    .from(userGroup)
    .where(and(
      eq(userGroup.userId, userId),
      eq(userGroup.groupName, groupName)
    ))
    .limit(1);

  if(existing) {
    return existing;
  }

  const [result] = await db
    .insert(userGroup)
    .values({
      id: crypto.randomBytes(16).toString('base64url'),
      userId,
      groupName,
      createdAt: new Date()
    })
    .returning();

  return result;
};
