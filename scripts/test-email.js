import 'dotenv/config';
import sendEmailFromTemplate from '../server/utils/email/sendEmailFromTemplate.js';

const testEmail = async () => {
  const testTo = process.argv[2];

  if(!testTo){
    console.error('Usage: npm run test:email <email@example.com>');
    process.exit(1);
  }

  console.log(`Sending test email to: ${testTo}`);

  try {
    const result = await sendEmailFromTemplate({
      to: testTo,
      subject: 'Test Email from Kempo',
      template: 'test',
      data: {
        name: 'Tester',
        timestamp: new Date().toLocaleString()
      }
    });

    console.log('✓ Email sent successfully!');
    console.log('Message ID:', result.messageId);
  } catch(error) {
    console.error('✗ Failed to send email:', error.message);
    process.exit(1);
  }
};

testEmail();
