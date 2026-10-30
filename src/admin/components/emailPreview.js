import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';

/*
  Opens an email template as it would be sent, in a dialog. The preview's HTML is fetched and given to a sandboxed iframe as
  `srcdoc`, so the frame shows the email itself (its inlined styles), not the admin's page around it. It is not loaded by address,
  because the server refuses to let any frame load a page from it.
*/
export const previewEmailTemplate = async (template, title) => {
  const response = await fetch(`/kempo/api/email-templates/preview?template=${encodeURIComponent(template)}`, { cache: 'no-store' });
  if(!response.ok){
    Toast.error('The email could not be previewed');
    return;
  }
  const frame = document.createElement('iframe');
  frame.srcdoc = await response.text();
  frame.setAttribute('sandbox', '');
  frame.setAttribute('height', '480');
  frame.title = `Preview of ${title || template}`;
  frame.className = 'full b r';
  Dialog.create(frame, { title: title || template, width: '60rem', cancelText: 'Close' });
};
