const UNITS = { ms: 1, s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

/*
  Accepts a number of milliseconds or a string such as "30s", "15m", "24h" or "7d". Returns null for
  anything else, including zero and negative values, so a caller can tell "invalid" from "no limit".
*/
export default (value) => {
  if(typeof value === 'number'){
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if(typeof value !== 'string') return null;

  const match = value.trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
  if(!match) return null;

  const milliseconds = Number(match[1]) * UNITS[match[2]];
  return milliseconds > 0 ? milliseconds : null;
};
