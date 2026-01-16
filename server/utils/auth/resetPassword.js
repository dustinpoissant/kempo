import bcrypt from 'bcrypt';
import db from '../../db/index.js';
import { verificationToken, user, session } from '../../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';

export default async ({ token, password, logoutAll = false }) => {
  if(!token){
    return [{ code: 400, msg: 'Reset token is required' }, null];
  }
  
  if(!password){
    return [{ code: 400, msg: 'Password is required' }, null];
  }
  
  try {
    const result = await db
      .select()
      .from(verificationToken)
      .where(and(
        eq(verificationToken.token, token),
        eq(verificationToken.type, 'password_reset'),
        gt(verificationToken.expiresAt, new Date())
      ))
      .limit(1);

    if(result.length === 0){
      return [{ code: 400, msg: 'Invalid or expired password reset token' }, null];
    }

    const tokenRecord = result[0];
    const passwordHash = await bcrypt.hash(password, 10);

    await db
      .update(user)
      .set({ 
        passwordHash,
        updatedAt: new Date()
      })
      .where(eq(user.id, tokenRecord.userId));

    await db
      .delete(verificationToken)
      .where(eq(verificationToken.token, token));

    if(logoutAll){
      await db
        .delete(session)
        .where(eq(session.userId, tokenRecord.userId));
    }

    return [null, { 
      success: true,
      userId: tokenRecord.userId
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to reset password' }, null];
  }
};
