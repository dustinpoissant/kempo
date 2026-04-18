# Email

## Description
Transactional email system using Resend for delivery and kempo-server's `renderPageToString` for template rendering. Email templates are standard `.page.html` files that use the same template system as the rest of the site.

## Dependencies
- [Resend](https://resend.com/) — email delivery service
- kempo-server `renderPageToString` — renders `.page.html` email templates to HTML strings

## Context
Email is used for account verification and password reset flows. The system is designed to be extensible — extensions can send emails using the same infrastructure.

### Decisions
- **Resend as provider**: Chosen for its simple API and developer experience. Requires `RESEND_API_KEY` in `.env`.
- **kempo-server templating instead of Handlebars**: Email templates are `.page.html` files rendered through `renderPageToString` from `kempo-server/templating`. This removes the Handlebars dependency and means email templates use the exact same syntax (`{{varName}}`, `<if>`, `<foreach>`) as every other page in the project.
- **Two send methods**: `sendEmail` for raw HTML, `sendEmailFromTemplate` for template-based emails. Template data is passed as `vars` to `renderPageToString`.
- **Consumer override**: `sendEmailFromTemplate` checks the consumer's `templates/emails/` directory first before falling back to kempo's built-in `app-templates/emails/`. This lets consumers customize email templates.
- **URL token substitution**: URL settings (e.g., `system:verification_url = "http://localhost:3000/verify-email/{{token}}"`) use a plain `string.replace('{{token}}', token)` — no templating library needed for single-variable URL patterns.

## Implementation

### Server Utils
| Util | Purpose |
|---|---|
| `sendEmail({ to, subject, html })` | Send raw HTML email via Resend |
| `sendEmailFromTemplate({ to, subject, template, data })` | Render `.page.html` template with `renderPageToString`, then send |

### Template Resolution
`sendEmailFromTemplate` resolves templates in this order:
1. `{cwd}/templates/emails/{template}.page.html` — consumer's customized template
2. `app-templates/emails/{template}.page.html` — kempo's built-in template

### Email Templates
Located in `app-templates/emails/`:
| Template | Purpose |
|---|---|
| `email.template.html` | Base email layout wrapper |
| `verify-email.page.html` | Email verification message |
| `reset-password.page.html` | Password reset message |
| `test.page.html` | Test email for development |

### Settings
- `RESEND_API_KEY` — environment variable for Resend authentication
- `SMTP_FROM` — environment variable for the sender address (defaults to `onboarding@resend.dev`)
- Templates are copied to the consumer's `templates/emails/` during `npx kempo init`

## Notes
- Email templates support the full kempo-server template syntax: `{{variable}}`, `<if condition="...">`, `<foreach>`, fragments, and global content.
- The `test:email` npm script can be used to verify email configuration during development.
