import { requestAccountDeletion } from '../../../../../../server/utils/auth/accountDeletion.js';

/* POST /kempo/api/auth/account-deletion/request  { email } — emails a code to the account, if there is one. */
export default async (request, response) => {
  const [error, result] = await requestAccountDeletion({ email: request.body?.email });
  if(error) return response.status(error.code).json({ error: error.msg });
  response.json(result);
};
