import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import sendEmail from '../../../../../server/utils/email/sendEmail.js';
import isValidSender from '../../../../../server/utils/email/isValidSender.js';

/* Sends a short test email to an address, through whichever email extension is installed. Body: `{ to }`. Answers with how it went. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:emails:manage');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const to = String(request.body?.to ?? '').trim();
	if(!isValidSender(to) || to.includes('<')) return response.status(400).json({ error: 'Enter an email address to send the test to' });

	const [error, result] = await sendEmail({
		to,
		subject: 'A test email from Kempo',
		html: '<p>This is a test email. If you can read it, sending email works.</p>',
		template: 'test',
	});
	if(error) return response.json({ sent: false, error: error.msg, emailId: error.emailId });

	response.json({ sent: true, ...result });
};
