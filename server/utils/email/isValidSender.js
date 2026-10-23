/* Whether text can be the address emails are sent from: `name@example.com` or `Shop Name <name@example.com>`, on one line. */
export default value => typeof value === 'string'
  && value.length <= 200
  && /^(?:[^<>\r\n@]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>|[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)$/.test(value.trim());
