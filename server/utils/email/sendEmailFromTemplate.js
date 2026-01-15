import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Handlebars from 'handlebars';
import sendEmail from './sendEmail.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async ({ to, subject, template, data = {} }) => {
  const templatePath = join(__dirname, '../../../templates/emails', `${template}.html`);

  try {
    const templateContent = await readFile(templatePath, 'utf-8');
    const compiledTemplate = Handlebars.compile(templateContent);
    const html = compiledTemplate(data);

    return await sendEmail({ to, subject, html });
  } catch(error) {
    if(error.code === 'ENOENT'){
      throw new Error(`Email template not found: ${template}`);
    }
    throw error;
  }
};
