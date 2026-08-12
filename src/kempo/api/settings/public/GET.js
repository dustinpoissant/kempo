import getPublicSettings from '../../../../../server/utils/settings/getPublicSettings.js';

export default async (request, response) => {
  const [error, settings] = await getPublicSettings();

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(settings);
};
