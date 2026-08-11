import { Resend } from 'resend';

/*
  Constructed on first send, not at import. The Resend constructor throws when the key is missing,
  and this module is reachable from the server SDK, so building it at module scope made an unset
  RESEND_API_KEY fail every route that transitively imports it rather than just disabling email.
*/
let resend = null;
const client = () => (resend ??= new Resend(process.env.RESEND_API_KEY));

export default async ({ to, subject, html }) => {
  if(!process.env.RESEND_API_KEY){
    return [{ code: 500, msg: 'RESEND_API_KEY not configured' }, null];
  }

  if(!to){
    return [{ code: 400, msg: 'Recipient email is required' }, null];
  }
  
  if(!subject){
    return [{ code: 400, msg: 'Email subject is required' }, null];
  }
  
  if(!html){
    return [{ code: 400, msg: 'Email content is required' }, null];
  }

  const from = process.env.SMTP_FROM || 'onboarding@resend.dev';

  try {
    const { data, error } = await client().emails.send({
      from,
      to,
      subject,
      html,
    });

    if(error){
      console.error('Email send error:', error);
      return [{ code: 500, msg: error.message || 'Failed to send email' }, null];
    }

    return [null, { success: true, messageId: data.id }];
  } catch(error){
    console.error('Email send error:', error);
    return [{ code: 500, msg: 'Failed to send email' }, null];
  }
};
