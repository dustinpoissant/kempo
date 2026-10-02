import { rm } from 'fs/promises';

export default async ({ setupDir }) => {
  if(!setupDir){
    return [{ code: 400, msg: 'Setup directory is required' }, null];
  }

  try {
    await rm(setupDir, { recursive: true, force: true });
  } catch(error){
    return [{ code: 500, msg: 'Failed to remove the setup files' }, null];
  }

  /*
    A running server only learns the files are gone on its next scan; without this the deleted
    page and route would keep answering until the process restarts.
  */
  try {
    const { default: rescan } = await import('kempo-server/rescan');
    await rescan();
  } catch {}

  return [null, { removed: true }];
};
