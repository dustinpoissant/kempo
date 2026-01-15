import db from '../../db/index.js';
import { verificationToken, user } from '../../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';

export default async ({ token }) => {
  const result = await db
    .select()
    .from(verificationToken)
    .where(and(
      eq(verificationToken.token, token),
      eq(verificationToken.type, 'email_verification'),
      gt(verificationToken.expiresAt, new Date())
    ))
    .limit(1);

  if(result.length === 0){
    return { error: 'Invalid or expired verification token', statusCode: 400 };
  }

  const tokenRecord = result[0];

  await db
    .update(user)
    .set({ 
      emailVerified: true,
      updatedAt: new Date()
    })
    .where(eq(user.id, tokenRecord.userId));

  await db
    .delete(verificationToken)
    .where(eq(verificationToken.token, token));

  return { 
    success: true,
    userId: tokenRecord.userId
  };
};
