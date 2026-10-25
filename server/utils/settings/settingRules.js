import isValidSender from '../email/isValidSender.js';

/*
  Rules for particular settings, checked whenever one is saved (the admin screen, the API and the SDK alike), because a bad value of
  these breaks something site-wide. Resolves to an `{ code, msg }` error, or null when the value is fine.
*/
const whole = (value, min, max) => Number.isInteger(Number(value)) && value !== '' && value !== null && Number(value) >= min && Number(value) <= max;

const RULES = {
  'system:email_max_retries': value => (whole(value, 0, 10) ? null : { code: 400, msg: 'Retries must be a whole number from 0 to 10' }),
  'system:email_retention_days': value => (whole(value, 0, 3650) ? null : { code: 400, msg: 'Retention must be a whole number of days from 0 to 3650' }),
  'system:email_retention_by_type': value => (value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(days => whole(days, 0, 3650))
    ? null
    : { code: 400, msg: 'Give each kind of email a whole number of days from 0 to 3650, like { "verify-email": 7 }' }),
  'system:session_cleanup_hours': value => (whole(value, 0, 8760) ? null : { code: 400, msg: 'Hours must be a whole number from 0 to 8760 (one year)' }),
  'system:email_from': value => (value === '' || isValidSender(value) ? null : { code: 400, msg: 'The sender must look like name@example.com or Shop Name <name@example.com>' }),
};

export default (owner, name, value) => {
  const rule = Object.hasOwn(RULES, `${owner}:${name}`) ? RULES[`${owner}:${name}`] : null;
  return rule ? rule(value) : null;
};
