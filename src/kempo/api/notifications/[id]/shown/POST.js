import resolveRecipient from '../../../../../../server/utils/notifications/resolveRecipient.js';
import markShown from '../../../../../../server/utils/notifications/markShown.js';
import { GUEST_COOKIE } from '../../../../../../server/utils/guests/constants.js';

export default async (request, response) => {
  const [recipientError, recipient] = await resolveRecipient({ sessionToken: request.cookies?.session_token, guestToken: request.cookies?.[GUEST_COOKIE] });

  if(recipientError){
    return response.status(recipientError.code).json({ error: recipientError.code === 500 ? recipientError.msg : 'Authentication required' });
  }

  const [error, result] = await markShown({ ...recipient, notificationId: request.params.id });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(result);
};
