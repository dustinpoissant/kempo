import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import updateUser from '../../../../server/utils/users/updateUser.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const { id, name, email, emailVerified, createdAt } = request.body;
  
  if(!id){
    return response.status(400).json({ error: 'User ID is required' });
  }

  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:user:update');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const updates = {};
  if(name !== undefined) updates.name = name;
  if(email !== undefined) updates.email = email;
  if(emailVerified !== undefined) updates.emailVerified = emailVerified;
  if(createdAt !== undefined) updates.createdAt = new Date(createdAt);
  
  const [error, result] = await updateUser(id, updates);
  
  if(error){
    return response.status(error.code).json({ error: error.msg });
  }
  
  response.json(result);
};
