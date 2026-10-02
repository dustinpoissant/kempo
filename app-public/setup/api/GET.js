import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import hasAdmin from 'kempo/server/utils/setup/hasAdmin.js';
import removeSetupFiles from 'kempo/server/utils/setup/removeSetupFiles.js';

/*
  Tells the setup page whether it is still needed. If an administrator was created some other way
  (init, makeAdmin) the setup files are deleted here, so they never outlive their purpose.
*/
export default async (request, response) => {
  const [error, adminExists] = await hasAdmin();

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  if(adminExists){
    await removeSetupFiles({ setupDir: join(dirname(fileURLToPath(import.meta.url)), '..') });
    return response.status(404).json({ error: 'Setup is already complete' });
  }

  response.json({ available: true });
};
