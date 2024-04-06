export default (scriptUrl, type = 'module') => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = type;
    script.src = scriptUrl;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
