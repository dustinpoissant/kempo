import { confirmAccountDeletion } from '../../../../../../server/utils/auth/accountDeletion.js';

/* POST /kempo/api/auth/account-deletion/confirm  { email, code } — deletes the account when the code is right. */
export default async (request, response) => {
  const [error, result] = await confirmAccountDeletion({ email: request.body?.email, code: request.body?.code });
  if(error) return response.status(error.code).json({ error: error.msg });
  response.json(result);
};
