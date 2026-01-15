import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async ({ to, subject, html }) => {
  if(!process.env.RESEND_API_KEY){
    throw new Error('RESEND_API_KEY not configured');
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
      throw new Error(error.message || 'Failed to send email');
    }

    return { success: true, messageId: data.id };
  } catch(error) {
    console.error('Email send error:', error);
    throw error;
  }
};
