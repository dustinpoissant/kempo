import renderEmailTemplate from './renderEmailTemplate.js';
import sendEmail from './sendEmail.js';

/*
  `template` is a plain name for kempo's and the site's templates, or "owner/name" for an extension's;
  see renderEmailTemplate.js. It is also the email's type in the log, which the retention settings go by.
  `replyTo` is passed on to sendEmail.
*/
export default async ({ to, subject, template, data = {}, replyTo = null }) => {
  if(!to){
    return [{ code: 400, msg: 'Recipient email is required' }, null];
  }

  if(!subject){
    return [{ code: 400, msg: 'Email subject is required' }, null];
  }

  if(!template){
    return [{ code: 400, msg: 'Template name is required' }, null];
  }

  const [error, html] = await renderEmailTemplate({ template, data });
  if(error){
    return [error, null];
  }

  return await sendEmail({ to, subject, html, template, replyTo });
};
