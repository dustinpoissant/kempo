export default (timestamp, format, forceLocale) => {
  const date = new Date(parseInt(timestamp));
  if (format) {
    const pad = (num, size) => ('000' + num).slice(size * -1);
    const tokens = {
      YYYY: date.getFullYear(),
      YY: String(date.getFullYear()).slice(-2),
      MM: pad(date.getMonth() + 1, 2),
      M: date.getMonth() + 1,
      DD: pad(date.getDate(), 2),
      D: date.getDate(),
      hh: pad(date.getHours(), 2),
      h: date.getHours(),
      mm: pad(date.getMinutes(), 2),
      m: date.getMinutes(),
      ss: pad(date.getSeconds(), 2),
      s: date.getSeconds(),
      iiii: pad(date.getMilliseconds(), 3),
      iii: pad(date.getMilliseconds(), 3),
      ii: pad(date.getMilliseconds(), 2),
      i: date.getMilliseconds()
    };
    return format.replace(/YYYY|YY|MM|M|DD|D|hh|h|mm|m|ss|s|iiii|iii|ii|i/g, (matched) => tokens[matched]);
  } else {
    return date.toLocaleString(forceLocale || navigator.language);
  }
}