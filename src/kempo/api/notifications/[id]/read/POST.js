import getSession from '../../../../../../server/utils/auth/getSession.js';
import markRead from '../../../../../../server/utils/notifications/markRead.js';

export default async (request, response) => {
  const [sessionError, sessionData] = await getSession({ token: request.cookies.session_token });

  if(sessionError){
    return response.status(sessionError.code === 500 ? 500 : 401).json({ error: sessionError.code === 500 ? sessionError.msg : 'Authentication required' });
  }

  const [error, result] = await markRead({ userId: sessionData.user.id, notificationId: request.params.id });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(result);
};
