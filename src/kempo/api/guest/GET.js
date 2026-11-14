import getGuest from '../../../../server/utils/guests/getGuest.js';
import { GUEST_COOKIE } from '../../../../server/utils/guests/constants.js';

export default async (request, response) => {
  const token = request.cookies?.[GUEST_COOKIE];

  if(!token){
    return response.status(204).send('');
  }

  const [error, result] = await getGuest({ token });

  if(error?.code === 404){
    return response.status(204).send('');
  }

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json({ createdAt: result.guest.createdAt });
};
