import createUser from '../users/createUser.js';
import addUserToGroup from '../groups/addUserToGroup.js';
import hasAdmin from './hasAdmin.js';
import removeSetupFiles from './removeSetupFiles.js';

let running = false;

export default async ({ name, email, password, setupDir }) => {
  if(!password || password.length < 8){
    return [{ code: 400, msg: 'Password must be at least 8 characters' }, null];
  }

  /*
    The admin check and the user insert are not one transaction, so two simultaneous requests on a
    fresh install could both pass the check. Setup runs once per install, so a process-level lock
    is enough to close that.
  */
  if(running){
    return [{ code: 409, msg: 'Setup is already in progress' }, null];
  }
  running = true;

  try {
    const [checkError, adminExists] = await hasAdmin();
    if(checkError){
      return [checkError, null];
    }
    if(adminExists){
      await removeSetupFiles({ setupDir });
      return [{ code: 404, msg: 'Setup is already complete' }, null];
    }

    const [createError, created] = await createUser({ name, email, password, emailVerified: true });
    if(createError){
      return [createError, null];
    }

    const [groupError] = await addUserToGroup(created.user.id, 'system:Administrators');
    if(groupError){
      return [groupError, null];
    }

    const [removeError] = await removeSetupFiles({ setupDir });

    return [null, { user: created.user, setupFilesRemoved: !removeError }];
  } finally {
    running = false;
  }
};
