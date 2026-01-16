import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const { data, error } = await resend.emails.send({
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
