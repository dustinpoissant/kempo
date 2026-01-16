import db from '../../db/index.js';
import { verificationToken, user } from '../../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';

export default async ({ token }) => {
  if(!token){
    return [{ code: 400, msg: 'Verification token is required' }, null];
  }
  
  try {
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
      return [{ code: 400, msg: 'Invalid or expired verification token' }, null];
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

    return [null, { 
      success: true,
      userId: tokenRecord.userId
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to verify email' }, null];
  }
};
