import getSetting from '../settings/getSetting.js';
import isValidSender from './isValidSender.js';
import PLACEHOLDER from './defaultSender.js';

/*
  What kempo sends its emails from, as the email provider takes it. In order:

    the `system:email_from` setting   edited on the admin Settings screen (it must be a valid address, or empty)
    `EMAIL_FROM`                      the server environment; what the README and `kempo init` write
    `SMTP_FROM`                       what the environment used to be called
    a placeholder address (noreply@example.com), which most providers will refuse until the site sets its own

  A value that is not an address is skipped rather than sent, so a bad environment value cannot stop every email.
*/
export default async () => {
  const [, stored] = await getSetting('system', 'email_from', '');
  return [stored, process.env.EMAIL_FROM, process.env.SMTP_FROM].map(value => String(value ?? '').trim()).find(isValidSender) ?? PLACEHOLDER;
};
