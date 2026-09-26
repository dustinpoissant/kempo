import Hub from './Hub.js';

/*
  One hub per process, held on a Symbol.for global for the same reason as the channel registry: the
  route that accepts a socket and an extension that publishes must reach the same instance even if
  kempo was resolved twice.
*/
const HUB = Symbol.for('kempo.realtime.hub');

export default () => {
  if(!globalThis[HUB]){
    globalThis[HUB] = new Hub();
  }
  return globalThis[HUB];
};
