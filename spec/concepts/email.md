# Email

## Description
Kempo queues and logs email and an **email extension** sends it. Kempo renders the template (kempo-server's templating, shaken kempo-css), saves the email in the `email` table, and fires the `email:send` hook; the extension (kempo-resend, kempo-smtp...) sends it and answers. The table is the log: what was asked, to whom, whether and when it went, and why not.

## Dependencies
- kempo-server templating (`renderEmailTemplate`) — renders `.page.html` email templates to HTML
- An email extension to actually send (kempo-resend, kempo-smtp). With none installed emails are logged and fail with "No email extension is installed".

## Context
Email is used for account verification and password reset, and by extensions (orders, notifications). Nothing in kempo depends on a particular provider.

### Decisions
- **Kempo sends nothing itself.** A provider is an extension, so kempo has no email vendor in its dependencies and a site can use any (HTTP API, SMTP, a log only).
- **The log is the queue.** `sendEmail` inserts a row (`queued`), takes it (`sending`, one conditional UPDATE so only one process sends it) and fires `email:send`. It ends `sent`, back to `queued` for a retry, or `failed`. A sender never touches the table.
- **One sender per email.** The hook is fired with `stopWhen`: the first handler to return `{ sent: true }` ends the chain. A handler that fails returns `{ sent: false, error }` (or throws) and the next installed sender tries, which gives failover for free. Handlers run in the order they were registered.
- **Retries are a setting.** `email_max_retries` (default 1) is how many tries come after the first. A scheduled job (`kempo:email-maintenance`, every minute, registered by kempo itself) sends queued emails again at least a minute after the last try, marks one that is over a day old `failed` instead of sending it late, brings back a `sending` email that did not finish in five minutes, and deletes old emails.
- **Retention is a setting.** `email_retention_days` (default 30, 0 keeps forever), with `email_retention_by_type` ({ template: days }) overriding it for a kind of email. An email's type is the template it was made from (`verify-email`, `kempo-commerce/order-processing`) or `other`.
- **The log is sensitive.** An email can hold a link that signs someone in or sets a password. Reading it needs `system:emails:read`; trying again and the test email need `system:emails:manage`.
- **kempo-server templating instead of Handlebars**: Email templates are `.page.html` files using the same syntax (`{{varName}}`, `<if>`, `<foreach>`) as every other page.
- **Consumer override**: a template in the site's `templates/emails/` wins over kempo's built-in `app-templates/emails/` (and an extension's `emails/`).

## Implementation

### Server Utils
| Util | Purpose |
|---|---|
| `sendEmail({ to, subject, html, template })` | Log the email and send it through the installed email extension. `[null, { id, status: 'sent' }]` or `[{ code, msg, emailId }, null]` (503 no extension, 502 it failed) |
| `sendEmailFromTemplate({ to, subject, template, data })` | Render a template, then `sendEmail` |
| `listEmails`, `getEmail`, `retryEmail`, `pruneEmails` | The log |
| `getSenderEmail()` | The bare address emails are sent from |

### The email:send hook
Payload `{ email: { id, to, from, fromIsDefault, subject, html, type, attempt } }`. Answer `{ sent: true, provider, messageId }`, `{ sent: false, error }`, or `{ sent: false, skipped: true, error }` when the extension is not set up (not counted as a try, and its reason is only shown when nothing else tried). `fromIsDefault` means `from` is only the placeholder.

### Settings
- `system:email_from` — the address emails are sent from, else `EMAIL_FROM` in the environment (`SMTP_FROM` is still read), else `noreply@example.com`. It must look like `name@example.com` or `Shop Name <name@example.com>`; one that does not is skipped, and the setting cannot be saved as one.
- `system:email_max_retries`, `system:email_retention_days`, `system:email_retention_by_type` — above.
- A provider's own settings (API key, SMTP host...) belong to its extension, on a tab of the admin Settings screen.

### Admin
`/admin/emails`: the log with status and search, each email with its body, **Try again** and **Send a test email**.

### Email Templates
Located in `app-templates/emails/`: `email.template.html` (the layout), `verify-email.page.html`, `reset-password.page.html`, `test.page.html`. Templates are copied to the consumer's `templates/emails/` during `npx kempo init`.
