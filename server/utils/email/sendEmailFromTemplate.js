import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { renderPage } from 'kempo-server/templating';
import shake from 'kempo-css/shake';
import sendEmail from './sendEmail.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async ({ to, subject, template, data = {} }) => {
  if(!to){
    return [{ code: 400, msg: 'Recipient email is required' }, null];
  }

  if(!subject){
    return [{ code: 400, msg: 'Email subject is required' }, null];
  }

  if(!template){
    return [{ code: 400, msg: 'Template name is required' }, null];
  }

  const consumerDir = join(process.cwd(), 'templates/emails');
  const moduleDir = join(__dirname, '../../../app-templates/emails');
  const rootDir = existsSync(join(consumerDir, `${template}.page.html`)) ? consumerDir : moduleDir;
  const pagePath = join(rootDir, `${template}.page.html`);

  if(!existsSync(pagePath)){
    return [{ code: 404, msg: `Email template not found: ${template}` }, null];
  }

  const themePath = join(process.cwd(), 'public/styles.css');
  const themeOpts = existsSync(themePath) ? { theme: themePath } : {};

  try {
    let html = await renderPage(pagePath, rootDir, {}, data);
    const css = shake(html, { ...themeOpts, colorMode: 'light' });
    html = html.replace('</head>', `<style>${css}</style></head>`);
    return await sendEmail({ to, subject, html });
  } catch(error){
    console.error('Email render error:', error);
    return [{ code: 500, msg: 'Failed to send email from template' }, null];
  }
};
