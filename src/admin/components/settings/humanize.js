/*
  A readable name for a setting, made from its name, so nobody has to write one:

    session_duration_days  ->  Session Duration Days
    verification_url       ->  Verification URL
    shippoCacheMinutes     ->  Shippo Cache Minutes

  Words are split on `_`, `-`, `.`, `:` and spaces and where a lowercase letter meets a capital. Each gets a capital, and the
  well-known abbreviations are written in capitals.
*/
const ACRONYMS = new Set(['api', 'css', 'html', 'id', 'ip', 'js', 'json', 'seo', 'smtp', 'sms', 'sql', 'ssl', 'tls', 'ui', 'uri', 'url', 'utc', 'uuid', 'xml']);

export default name => String(name ?? '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .split(/[\s_\-.:]+/)
  .filter(Boolean)
  .map(word => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
  .join(' ');
