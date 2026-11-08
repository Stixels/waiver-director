export function configuredFromEmail(): string | null {
	return process.env.RESEND_FROM_EMAIL?.trim() || null;
}

function emailDisplayName(value: string): string {
	return (
		value
			.replace(/[\r\n<>]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim() || 'Waiver'
	);
}

export function friendlyFromAddress(displayName: string, email: string): string {
	const escapedName = emailDisplayName(displayName).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return `"${escapedName}" <${email}>`;
}
