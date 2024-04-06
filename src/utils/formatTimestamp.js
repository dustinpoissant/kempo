export default (timestamp, forceLocale) => {
  return Intl.DateTimeFormat(forceLocale || navigator.language, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    millisecond: '3-digit'
  }).format(new Date(parseInt(timestamp)));
}