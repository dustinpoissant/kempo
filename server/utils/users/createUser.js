import crypto from 'crypto';
import bcrypt from 'bcrypt';
import db from '../../db/index.js';
import { user } from '../../db/schema.js';

const generateId = () => crypto.randomBytes(16).toString('hex');

export default async ({ name, email, password, emailVerified = false }) => {
  if(!email || !password){
    return [{ code: 400, msg: 'Email and password are required' }, null];
  }
  
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    
    const newUser = await db.insert(user).values({
      id: generateId(),
      email,
      name,
      passwordHash,
      emailVerified,
      createdAt: now,
      updatedAt: now,
    }).returning();
    
    return [null, {
      id: newUser[0].id,
      email: newUser[0].email,
      name: newUser[0].name,
      emailVerified: newUser[0].emailVerified,
    }];
  } catch(error){
    if(error.code === '23505'){
      return [{ code: 409, msg: 'User with this email already exists' }, null];
    }
    return [{ code: 500, msg: 'Failed to create user' }, null];
  }
};
