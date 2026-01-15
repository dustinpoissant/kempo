import { getPublicSettings } from '../../../../../server/utils/settings/settings.js';

export default async (request) => {
  const settings = await getPublicSettings();

  return new Response(JSON.stringify(settings), {
    headers: { 'Content-Type': 'application/json' }
  });
};
