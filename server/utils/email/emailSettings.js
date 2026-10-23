import getSetting from '../settings/getSetting.js';

const DEFAULT_RETRIES = 1;
const DEFAULT_RETENTION_DAYS = 30;

const whole = (value, fallback) => (Number.isInteger(Number(value)) && value !== '' && value !== null && Number(value) >= 0 ? Number(value) : fallback);

/*
  What the email settings say, with a safe value for anything unreadable: `maxRetries` (tries after the first), `retentionDays` (0 keeps
  forever) and `retentionByType` ({ type: days }), which wins over `retentionDays` for that kind of email.
*/
export default async () => {
  const [, retries] = await getSetting('system', 'email_max_retries', DEFAULT_RETRIES);
  const [, days] = await getSetting('system', 'email_retention_days', DEFAULT_RETENTION_DAYS);
  const [, byType] = await getSetting('system', 'email_retention_by_type', {});
  const retentionByType = {};
  if(byType && typeof byType === 'object' && !Array.isArray(byType)){
    for(const [type, value] of Object.entries(byType)) if(whole(value, null) !== null) retentionByType[type] = Number(value);
  }
  return { maxRetries: whole(retries, DEFAULT_RETRIES), retentionDays: whole(days, DEFAULT_RETENTION_DAYS), retentionByType };
};
