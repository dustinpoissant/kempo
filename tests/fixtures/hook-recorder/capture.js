export default data => {
  (globalThis.capturedHooks ||= []).push(JSON.stringify(data));
};
