function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function oneLine(value: string): string {
	return value.replace(/[\r\n]+/g, ' ').trim();
}

export type GuestReminderEmailInput = {
	workspaceName: string;
	leadCustomerName: string | null;
	activityName: string;
	when: string | null;
	signedCount: number;
	participantCount: number;
	signingUrl: string;
	returningGuestsCanSkip: boolean;
};

/** Builds the reminder sent to a booking's lead customer while guests are still unsigned. */
export function buildGuestReminderEmail(input: GuestReminderEmailInput) {
	const workspaceName = oneLine(input.workspaceName) || 'your booking';
	const activityName = oneLine(input.activityName);
	const remaining = Math.max(0, input.participantCount - input.signedCount);
	const stillNeed = remaining === 1 ? 'guest still needs' : 'guests still need';
	const greetingName = input.leadCustomerName ? oneLine(input.leadCustomerName) : null;
	const whenText = input.when ? ` on ${input.when}` : '';

	const subject = `Reminder: ${remaining} ${stillNeed} to sign the waiver for ${activityName}`;
	const greeting = greetingName ? `Hi ${greetingName},` : 'Hi there,';
	const summary = `${input.signedCount} of ${input.participantCount} guests have signed the waiver for ${activityName}${whenText}.`;
	const ask =
		`Please share this link with everyone in your group who hasn't signed yet, so check-in is quick when you arrive.` +
		(input.returningGuestsCanSkip
			? ` Guests with a current waiver on file with ${workspaceName} can confirm it instead of signing again.`
			: '');

	const text = [
		greeting,
		'',
		summary,
		'',
		ask,
		'',
		`Sign the waiver: ${input.signingUrl}`,
		'',
		`See you soon,`,
		workspaceName
	].join('\n');

	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px 40px 32px;max-width:600px;width:100%">
        <tr><td style="color:#1a1a1a;font-size:15px;line-height:1.6">
          <p style="margin:0 0 16px 0;line-height:1.6;font-size:15px">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 16px 0;line-height:1.6;font-size:15px">${escapeHtml(summary)}</p>
          <p style="margin:0 0 24px 0;line-height:1.6;font-size:15px">${escapeHtml(ask)}</p>
          <p style="margin:0 0 24px 0"><a href="${escapeHtml(input.signingUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:6px">Sign the waiver</a></p>
          <p style="margin:0 0 4px 0;line-height:1.6;font-size:13px;color:#6b7280">Or copy this link: ${escapeHtml(input.signingUrl)}</p>
          <p style="margin:24px 0 0 0;line-height:1.6;font-size:15px">See you soon,<br/>${escapeHtml(workspaceName)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

	return { subject: oneLine(subject), html, text };
}
