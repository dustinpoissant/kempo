import db from '../../db/index.js';
import { permission } from '../../db/schema.js';

export default async ({ resource, action, description, owner }) => {
  if(!resource){
    return [{ code: 400, msg: 'Resource name is required' }, null];
  }

  if(resource.includes(':')){
    return [{ code: 400, msg: 'Resource name cannot contain ":"' }, null];
  }

  if(!action){
    return [{ code: 400, msg: 'Action is required' }, null];
  }

  if(action.includes(':')){
    return [{ code: 400, msg: 'Action cannot contain ":"' }, null];
  }

  if(!owner){
    return [{ code: 400, msg: 'Permission owner is required' }, null];
  }

  try {
    const [result] = await db
      .insert(permission)
      .values({
        name: `${owner}:${resource}:${action}`,
        description,
        owner,
        createdAt: new Date()
      })
      .returning();

    return [null, result];
  } catch(error){
    if(error.code === '23505'){
      return [{ code: 409, msg: 'Permission already exists' }, null];
    }
    return [{ code: 500, msg: 'Failed to create permission' }, null];
  }
};
