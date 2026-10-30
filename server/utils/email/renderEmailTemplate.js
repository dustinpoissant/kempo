import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { renderPage, renderExternalPage } from 'kempo-server/templating';
import { filterCss } from './mailClientView.js';
import treeShake from './treeShake.js';
import inlineStyles from './inlineStyles.js';
import { getStylesheet, stylesheetFor } from './stylesheets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/*
  Renders an email template to HTML, without sending it.

  A plain name ("verify-email") is looked up in the site's `templates/emails`, then in kempo's own.

  A name with an owner ("my-extension/order-paid") is an extension's template. The site may override
  it at `templates/emails/my-extension/order-paid.page.html`; otherwise it is the extension's own
  `emails/order-paid.page.html`. Either way the layout (`<page template="email">`) is the site's
  `templates/emails/email.template.html` when it has one, and kempo's otherwise, so every email a site
  sends looks the same.

  Returns [error, html].
*/
export default async ({ template, data = {} } = {}) => {
  if(!template){
    return [{ code: 400, msg: 'Template name is required' }, null];
  }
  if(!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?$/.test(template)){
    return [{ code: 400, msg: `Invalid email template name: ${template}` }, null];
  }

  const consumerDir = join(process.cwd(), 'templates/emails');
  const moduleDir = join(__dirname, '../../../app-templates/emails');
  const [owner, name] = template.includes('/') ? template.split('/') : [null, template];

  let pagePath;
  let rootDir;
  if(owner){
    const override = join(consumerDir, owner, `${name}.page.html`);
    pagePath = existsSync(override) ? override : join(process.cwd(), 'node_modules', owner, 'emails', `${name}.page.html`);
    rootDir = existsSync(join(consumerDir, 'email.template.html')) ? consumerDir : moduleDir;
  } else {
    rootDir = existsSync(join(consumerDir, `${name}.page.html`)) ? consumerDir : moduleDir;
    pagePath = join(rootDir, `${name}.page.html`);
  }

  if(!existsSync(pagePath)){
    return [{ code: 404, msg: `Email template not found: ${template}` }, null];
  }


  try {
    let html = owner
      ? await renderExternalPage(pagePath, rootDir, rootDir, {}, data)
      : await renderPage(pagePath, rootDir, {}, data);
    const [, sheet] = await getStylesheet(await stylesheetFor(template));
    const css = treeShake(filterCss(sheet.css), html);
    html = inlineStyles(html, css);
    return [null, html];
  } catch(error){
    console.error('Email render error:', error);
    return [{ code: 500, msg: 'Failed to render the email template' }, null];
  }
};
