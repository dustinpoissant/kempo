import getPublicSettings from '../../../../../server/utils/settings/getPublicSettings.js';

export default async (request) => {
  const [error, settings] = await getPublicSettings();

  if(error){
    return new Response(JSON.stringify({ error: error.msg }), {
      status: error.code,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(settings), {
    headers: { 'Content-Type': 'application/json' }
  });
};
