import getHub from './getHub.js';

// Only reaches a connection held by this process. To end a user's access everywhere, delete their sessions.
export default ({ connectionId, code, reason } = {}) => getHub().closeConnection({ connectionId, code, reason });
