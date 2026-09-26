import getHub from './getHub.js';
import { unregisterChannel } from './channels.js';

/*
  Removes a channel that code registered, and lets go of everyone subscribed to it on this process.

  For a channel that exists only while something else does, such as one per running game. Register it
  before anyone can be told its name, and remove it when the thing ends. A channel an extension declares
  in kempo-config.json is not in the registry and is unaffected.
*/
export default ({ channel } = {}) => {
  if(typeof channel !== 'string' || !channel){
    return [{ code: 400, msg: 'A channel name is required' }, null];
  }

  const removed = unregisterChannel(channel);
  const [, { dropped }] = getHub().dropChannel({ channel });
  return [null, { removed, dropped }];
};
