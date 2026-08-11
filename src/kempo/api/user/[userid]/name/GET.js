import getUserById from '../../../../../../server/utils/users/getUserById.js';

export default async (request, response) => {
  const { userid } = request.params;
  const [error, user] = await getUserById(userid);
  if(error) return response.status(error.code).json({ error: error.msg });
  response.json({ name: user.name });
};
