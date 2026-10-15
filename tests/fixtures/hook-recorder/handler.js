export default data => {
  (globalThis.disabledHookCalls ||= []).push(data.tag);
};
