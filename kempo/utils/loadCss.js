export default (url, type = 'stylesheet') => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = type;
    link.href = url;
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);
  });
}