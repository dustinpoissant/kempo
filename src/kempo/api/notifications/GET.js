import resolveRecipient from '../../../../server/utils/notifications/resolveRecipient.js';
import getNotifications from '../../../../server/utils/notifications/getNotifications.js';
import { GUEST_COOKIE } from '../../../../server/utils/guests/constants.js';

export default async (request, response) => {
  const [recipientError, recipient] = await resolveRecipient({ sessionToken: request.cookies?.session_token, guestToken: request.cookies?.[GUEST_COOKIE] });

  if(recipientError){
    return response.status(recipientError.code).json({ error: recipientError.code === 500 ? recipientError.msg : 'Authentication required' });
  }

  response.setHeader('Cache-Control', 'private, no-store');

  const [error, result] = await getNotifications({ ...recipient, type: request.query.type, status: request.query.status, unreadOnly: request.query.unreadOnly === 'true', limit: request.query.limit, offset: request.query.offset });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(result);
};
