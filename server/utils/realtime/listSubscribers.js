import getHub from './getHub.js';

// The subscribers of a channel that this process holds; other processes hold their own.
export default ({ channel } = {}) => getHub().listSubscribers({ channel });
