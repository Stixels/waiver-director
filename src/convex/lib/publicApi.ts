import type { Doc } from '../_generated/dataModel';

// Shapes shared by the public read API and outbound webhook payloads. The signature image is
// intentionally excluded: it stays inside Waiver Director as part of the signed record.

export type PublicSubmission = ReturnType<typeof serializeSubmission>;

export function serializeSubmission(
	submission: Doc<'waiver_submissions'>,
	version: Doc<'waiver_versions'> | null
) {
	const fields = version?.fields ?? [];
	const fieldIds = new Set(fields.map((field) => field.id));
	const answers = fields.map((field) => {
		const raw = submission.answers[field.id] ?? null;
		const value =
			field.type === 'select' && typeof raw === 'string'
				? (field.options.find((option) => option.id === raw)?.label ?? raw)
				: raw;
		return { fieldId: field.id, label: field.label, type: field.type, value };
	});
	for (const [fieldId, value] of Object.entries(submission.answers)) {
		if (!fieldIds.has(fieldId)) {
			answers.push({ fieldId, label: fieldId, type: 'text', value });
		}
	}

	const booking = submission.bookingSnapshot;
	return {
		id: submission._id,
		object: 'submission' as const,
		submittedAt: new Date(submission.submittedAt).toISOString(),
		signer: {
			name: submission.signerName,
			email: submission.signerEmail,
			dateOfBirth: submission.signerDateOfBirth
		},
		minors: submission.minors.map((minor) => ({ name: minor.fullName })),
		answers,
		marketingConsent: submission.marketingConsent ?? false,
		customerId: submission.customerId ?? null,
		waiver: {
			versionId: submission.versionId,
			versionNumber: version?.versionNumber ?? null,
			title: version?.title ?? null
		},
		booking: booking
			? {
					provider: booking.provider,
					providerBookingId: booking.providerBookingId,
					activityName: booking.activityName,
					startTime: booking.startTime ?? null,
					endTime: booking.endTime ?? null,
					leadCustomerName: booking.leadCustomerName ?? null,
					leadCustomerEmail: booking.leadCustomerEmail ?? null
				}
			: null
	};
}

export function serializeCustomer(customer: Doc<'customers'>) {
	return {
		id: customer._id,
		object: 'customer' as const,
		name: customer.displayName,
		email: customer.primaryEmail,
		firstSeenAt: new Date(customer.firstSeenAt).toISOString(),
		lastSeenAt: new Date(customer.lastSeenAt).toISOString(),
		visitCount: customer.visitCount,
		latestSubmissionId: customer.latestSubmissionId
	};
}

export function serializeWorkspace(workspace: Doc<'workspaces'>) {
	return {
		id: workspace._id,
		object: 'workspace' as const,
		name: workspace.name,
		slug: workspace.slug
	};
}
