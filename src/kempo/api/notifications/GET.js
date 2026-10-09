import getSession from '../../../../server/utils/auth/getSession.js';
import getNotifications from '../../../../server/utils/notifications/getNotifications.js';

export default async (request, response) => {
  const [sessionError, sessionData] = await getSession({ token: request.cookies.session_token });

  if(sessionError){
    return response.status(sessionError.code === 500 ? 500 : 401).json({ error: sessionError.code === 500 ? sessionError.msg : 'Authentication required' });
  }

  const { unreadOnly, limit, offset } = request.query;
  const [error, result] = await getNotifications({
    userId: sessionData.user.id,
    unreadOnly: unreadOnly === 'true',
    limit,
    offset
  });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(result);
};
