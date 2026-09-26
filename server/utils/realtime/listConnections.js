import getHub from './getHub.js';

// Only this process's connections: sockets are held by the process that accepted them.
export default () => getHub().listConnections();
