import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import completeSetup from 'kempo/server/utils/setup/completeSetup.js';

/*
  Creates the first administrator and then deletes the whole setup directory, this route included.
  It only ever works once: completeSetup refuses when an administrator already exists.
*/
export default async (request, response) => {
  try {
    const { name, email, password } = request.body || {};
    const [error, result] = await completeSetup({
      name,
      email,
      password,
      setupDir: join(dirname(fileURLToPath(import.meta.url)), '..')
    });

    if(error){
      return response.status(error.code).json({ error: error.msg });
    }

    response.json({ user: result.user });
  } catch(error){
    console.error('Setup error:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
};
