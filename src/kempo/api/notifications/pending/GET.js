import resolveRecipient from '../../../../../server/utils/notifications/resolveRecipient.js';
import getPendingNotifications from '../../../../../server/utils/notifications/getPendingNotifications.js';
import { GUEST_COOKIE } from '../../../../../server/utils/guests/constants.js';

export default async (request, response) => {
  const [recipientError, recipient] = await resolveRecipient({ sessionToken: request.cookies?.session_token, guestToken: request.cookies?.[GUEST_COOKIE] });

  if(recipientError){
    return response.status(recipientError.code).json({ error: recipientError.code === 500 ? recipientError.msg : 'Authentication required' });
  }

  response.setHeader('Cache-Control', 'private, no-store');

  const [error, result] = await getPendingNotifications({ ...recipient });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(result);
};
