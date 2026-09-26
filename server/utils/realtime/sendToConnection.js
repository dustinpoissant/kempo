import getHub from './getHub.js';

// Connection ids belong to the process that holds the connection, so this only reaches one held by this process.
export default ({ connectionId, data } = {}) => getHub().sendToConnection({ connectionId, data });
