import { randomUUID } from 'crypto';
import getSetting from '../settings/getSetting.js';
import setSetting from '../settings/setSetting.js';

/*
  The random id this site uses to identify itself to the extension marketplace, so an install is
  counted once however many times an extension is uninstalled and reinstalled, and a site can have one
  rating per extension. Generated the first time it is needed and kept in `system:install_id`.

  It identifies nothing but this install: no name, address or account is attached to it.
*/
export default async () => {
  const [error, existing] = await getSetting('system', 'install_id', null);
  if(error) return [error, null];
  if(typeof existing === 'string' && existing) return [null, existing];

  const installId = randomUUID();
  const [setError] = await setSetting('system', 'install_id', installId, 'string', false, 'Random id this site uses to identify itself to the extension marketplace');
  if(setError) return [setError, null];
  return [null, installId];
};
