export default (v) => {
  if (typeof v === 'function') {
    return v;
  }
  if (typeof v === 'string') {
    const parts = v.split('.');
    let current = window;
    for (const part of parts) {
      current = current[part];
      if (current === undefined) {
        break;
      }
    }
    if (typeof current === 'function') {
      return current;
    }
    try {
      return new Function(v);
    } catch (e) {
      console.error('Failed to create function from string:', e);
    }
  }
  return () => v;
};
