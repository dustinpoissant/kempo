import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Handlebars from 'handlebars';
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
  
  const projectPath = join(process.cwd(), 'templates/emails', `${template}.html`);
  const modulePath = join(__dirname, '../../../app-templates/emails', `${template}.html`);
  const templatePath = existsSync(projectPath) ? projectPath : modulePath;

  try {
    const templateContent = await readFile(templatePath, 'utf-8');
    const compiledTemplate = Handlebars.compile(templateContent);
    const html = compiledTemplate(data);

    return await sendEmail({ to, subject, html });
  } catch(error){
    if(error.code === 'ENOENT'){
      return [{ code: 404, msg: `Email template not found: ${template}` }, null];
    }
    return [{ code: 500, msg: 'Failed to send email from template' }, null];
  }
};
