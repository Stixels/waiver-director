import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { getCurrentUser } from './auth';
import { getWorkspaceMembership } from './workspaces';
import { sanitizeRichTextHtml } from '../../lib/utils/rich-text';
import {
	MAX_MINOR_NAME_LENGTH,
	MAX_MINORS,
	MAX_SELECT_OPTION_LABEL_LENGTH,
	MAX_SELECT_OPTIONS,
	MAX_WAIVER_FIELD_LABEL_LENGTH,
	MAX_WAIVER_FIELDS,
	MAX_WAIVER_TITLE_LENGTH,
	MIN_MINOR_NAME_LENGTH,
	MIN_SELECT_OPTION_LABEL_LENGTH,
	MIN_SELECT_OPTIONS,
	MIN_WAIVER_FIELD_LABEL_LENGTH,
	MIN_WAIVER_TITLE_LENGTH
} from '../../lib/domain/waiver-constraints';
import {
	DEFAULT_MINIMUM_SIGNER_AGE,
	MAX_MINIMUM_SIGNER_AGE,
	MIN_MINIMUM_SIGNER_AGE,
	isMinorBirthDate,
	isSignerBirthDate,
	isValidIsoDate,
	isValidMinimumSignerAge
} from '../../lib/domain/waiver-constraints';
export { collectsMinorDateOfBirth } from '../../lib/domain/waiver-constraints';

type FunctionCtx = QueryCtx | MutationCtx;

export const waiverFieldValidator = v.union(
	v.object({
		id: v.string(),
		type: v.literal('text'),
		label: v.string(),
		required: v.boolean(),
		placeholder: v.optional(v.string())
	}),
	v.object({
		id: v.string(),
		type: v.literal('checkbox'),
		label: v.string(),
		required: v.boolean()
	}),
	v.object({
		id: v.string(),
		type: v.literal('select'),
		label: v.string(),
		required: v.boolean(),
		options: v.array(
			v.object({
				id: v.string(),
				label: v.string()
			})
		)
	}),
	v.object({
		id: v.string(),
		type: v.literal('date'),
		label: v.string(),
		required: v.boolean()
	})
);

export const waiverThemeValidator = v.union(v.literal('light'), v.literal('dark'));

export const waiverDefinitionValidator = v.object({
	title: v.string(),
	introCopy: v.string(),
	theme: v.optional(waiverThemeValidator),
	minimumSignerAge: v.optional(v.number()),
	collectMinorDateOfBirth: v.optional(v.boolean()),
	fields: v.array(waiverFieldValidator)
});

export const waiverAnswerValueValidator = v.union(v.string(), v.boolean(), v.null());

export const minorInputValidator = v.object({
	fullName: v.string(),
	dateOfBirth: v.optional(v.string())
});

export type WaiverDefinition = {
	title: string;
	introCopy: string;
	theme?: 'light' | 'dark';
	minimumSignerAge?: number;
	collectMinorDateOfBirth?: boolean;
	fields: Array<
		| {
				id: string;
				type: 'text';
				label: string;
				required: boolean;
				placeholder?: string;
		  }
		| {
				id: string;
				type: 'checkbox';
				label: string;
				required: boolean;
		  }
		| {
				id: string;
				type: 'select';
				label: string;
				required: boolean;
				options: Array<{
					id: string;
					label: string;
				}>;
		  }
		| {
				id: string;
				type: 'date';
				label: string;
				required: boolean;
		  }
	>;
};

export type MinorInput = {
	fullName: string;
	dateOfBirth?: string;
};

const PUBLIC_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])$/;

export function createDefaultWaiverDefinition(workspaceName: string): WaiverDefinition {
	return normalizeWaiverDefinition({
		title: `${workspaceName} Waiver`,
		introCopy: '<p></p>',
		theme: 'dark',
		minimumSignerAge: DEFAULT_MINIMUM_SIGNER_AGE,
		collectMinorDateOfBirth: false,
		fields: []
	});
}

export function createDefaultPublicWaiverSlug(workspaceSlug: string): string {
	return normalizePublicSlug(`${workspaceSlug}-waiver`);
}

export async function requireWorkspaceMember(
	ctx: FunctionCtx,
	workspaceId: Id<'workspaces'>
): Promise<{ user: Doc<'users'>; membership: Doc<'workspace_memberships'> }> {
	const user = await getCurrentUser(ctx);
	if (!user) {
		throw new ConvexError({
			code: 'unauthenticated',
			message: 'Not authenticated'
		});
	}

	const [membership, workspace] = await Promise.all([
		getWorkspaceMembership(ctx, workspaceId, user._id),
		ctx.db.get(workspaceId)
	]);
	if (
		!workspace ||
		workspace.status === 'archived' ||
		!membership ||
		membership.status !== 'active'
	) {
		throw new ConvexError({
			code: 'forbidden',
			message: 'You do not have access to this workspace.'
		});
	}

	return { user, membership };
}

export async function requireWorkspaceOwner(
	ctx: FunctionCtx,
	workspaceId: Id<'workspaces'>,
	action?: string
): Promise<{ user: Doc<'users'>; membership: Doc<'workspace_memberships'> }> {
	const access = await requireWorkspaceMember(ctx, workspaceId);
	if (access.membership.role !== 'owner') {
		throw new ConvexError({
			code: 'forbidden',
			message: action
				? `Only workspace owners may ${action}.`
				: 'Only workspace owners may perform this action.'
		});
	}

	return access;
}

export function assertWorkspaceRecord<
	T extends {
		workspaceId: Id<'workspaces'>;
	}
>(record: T | null, workspaceId: Id<'workspaces'>, message: string): T {
	if (!record || record.workspaceId !== workspaceId) {
		throw new ConvexError({
			code: 'not_found',
			message
		});
	}

	return record;
}

export function normalizeWaiverDefinition(definition: WaiverDefinition): WaiverDefinition {
	const title = definition.title.trim();
	const introCopy = sanitizeRichTextHtml(definition.introCopy);

	if (title.length < MIN_WAIVER_TITLE_LENGTH || title.length > MAX_WAIVER_TITLE_LENGTH) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: `Waiver title must be between ${MIN_WAIVER_TITLE_LENGTH} and ${MAX_WAIVER_TITLE_LENGTH} characters.`
		});
	}

	if (definition.fields.length > MAX_WAIVER_FIELDS) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: `Limit waivers to ${MAX_WAIVER_FIELDS} custom fields in this release.`
		});
	}

	const seenIds = new Set<string>();
	const fields = definition.fields.map((field) => {
		const id = field.id.trim();
		if (!/^[a-z0-9-]{3,64}$/.test(id)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Each field id must be 3-64 lowercase characters, numbers, or hyphens.'
			});
		}
		if (seenIds.has(id)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Field ids must be unique within a waiver.'
			});
		}
		seenIds.add(id);

		const label = field.label.trim();
		if (
			label.length < MIN_WAIVER_FIELD_LABEL_LENGTH ||
			label.length > MAX_WAIVER_FIELD_LABEL_LENGTH
		) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: `Each field label must be between ${MIN_WAIVER_FIELD_LABEL_LENGTH} and ${MAX_WAIVER_FIELD_LABEL_LENGTH} characters.`
			});
		}

		if (field.type === 'select') {
			if (field.options.length < MIN_SELECT_OPTIONS || field.options.length > MAX_SELECT_OPTIONS) {
				throw new ConvexError({
					code: 'invalid_argument',
					message: `Select fields require ${MIN_SELECT_OPTIONS}-${MAX_SELECT_OPTIONS} options.`
				});
			}

			const optionIds = new Set<string>();
			return {
				...field,
				id,
				label,
				options: field.options.map((option) => {
					const optionId = option.id.trim();
					const optionLabel = option.label.trim();
					if (!/^[a-z0-9-]{2,64}$/.test(optionId)) {
						throw new ConvexError({
							code: 'invalid_argument',
							message: 'Select option ids must be lowercase letters, numbers, or hyphens.'
						});
					}
					if (optionIds.has(optionId)) {
						throw new ConvexError({
							code: 'invalid_argument',
							message: 'Select option ids must be unique within a field.'
						});
					}
					if (
						optionLabel.length < MIN_SELECT_OPTION_LABEL_LENGTH ||
						optionLabel.length > MAX_SELECT_OPTION_LABEL_LENGTH
					) {
						throw new ConvexError({
							code: 'invalid_argument',
							message: `Select option labels must be between ${MIN_SELECT_OPTION_LABEL_LENGTH} and ${MAX_SELECT_OPTION_LABEL_LENGTH} characters.`
						});
					}
					optionIds.add(optionId);
					return {
						id: optionId,
						label: optionLabel
					};
				})
			};
		}

		if ('placeholder' in field) {
			return {
				...field,
				id,
				label,
				placeholder: field.placeholder?.trim() || undefined
			};
		}

		return {
			...field,
			id,
			label
		};
	});

	const minimumSignerAge = definition.minimumSignerAge ?? DEFAULT_MINIMUM_SIGNER_AGE;
	if (!isValidMinimumSignerAge(minimumSignerAge)) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: `Minimum signer age must be a whole number from ${MIN_MINIMUM_SIGNER_AGE} to ${MAX_MINIMUM_SIGNER_AGE}.`
		});
	}

	return {
		title,
		introCopy,
		theme: definition.theme ?? 'dark',
		minimumSignerAge,
		collectMinorDateOfBirth: definition.collectMinorDateOfBirth ?? false,
		fields
	};
}

function normalizeWaiverDefinitionForCompare(definition: WaiverDefinition): WaiverDefinition {
	return {
		title: definition.title.trim(),
		introCopy: sanitizeRichTextHtml(definition.introCopy),
		theme: definition.theme ?? 'dark',
		minimumSignerAge: definition.minimumSignerAge ?? DEFAULT_MINIMUM_SIGNER_AGE,
		collectMinorDateOfBirth: definition.collectMinorDateOfBirth ?? false,
		fields: definition.fields.map((field) => {
			if (field.type === 'select') {
				return {
					...field,
					label: field.label.trim(),
					options: field.options.map((option) => ({
						id: option.id.trim(),
						label: option.label.trim()
					}))
				};
			}

			if ('placeholder' in field) {
				return {
					...field,
					label: field.label.trim(),
					placeholder: field.placeholder?.trim() || undefined
				};
			}

			return {
				...field,
				label: field.label.trim()
			};
		})
	};
}

export function waiverDefinitionsEqual(a: WaiverDefinition, b: WaiverDefinition): boolean {
	return (
		JSON.stringify(normalizeWaiverDefinitionForCompare(a)) ===
		JSON.stringify(normalizeWaiverDefinitionForCompare(b))
	);
}

export function validateSubmissionAnswers(
	definition: Pick<WaiverDefinition, 'fields'>,
	answers: Record<string, string | boolean | null>
) {
	for (const field of definition.fields) {
		const answer = answers[field.id] ?? null;

		if (field.type === 'checkbox') {
			if (field.required && answer !== true) {
				throw new ConvexError({
					code: 'invalid_argument',
					message: `Please accept "${field.label}".`
				});
			}
			continue;
		}

		const stringValue = typeof answer === 'string' ? answer.trim() : '';
		if (field.required && stringValue.length === 0) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: `Please complete "${field.label}".`
			});
		}

		if (field.type === 'select' && stringValue.length > 0) {
			const matchingOption = field.options.some((option) => option.id === stringValue);
			if (!matchingOption) {
				throw new ConvexError({
					code: 'invalid_argument',
					message: `Please choose a valid option for "${field.label}".`
				});
			}
		}
	}
}

/**
 * Checks minor names, and when `requireDateOfBirth` is on, each minor's date of
 * birth and that they are under 18. When it is off, any date of birth sent is
 * dropped so unchecked dates are never stored.
 */
export function validateMinors(
	minors: MinorInput[],
	{ requireDateOfBirth }: { requireDateOfBirth: boolean }
): MinorInput[] {
	if (minors.length === 0) {
		return [];
	}

	if (minors.length > MAX_MINORS) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: `Add at most ${MAX_MINORS} minors to one submission.`
		});
	}

	return minors.map((minor) => {
		const fullName = minor.fullName.trim();
		if (fullName.length < MIN_MINOR_NAME_LENGTH || fullName.length > MAX_MINOR_NAME_LENGTH) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: `Each minor name must be between ${MIN_MINOR_NAME_LENGTH} and ${MAX_MINOR_NAME_LENGTH} characters.`
			});
		}
		if (!requireDateOfBirth) {
			return { fullName };
		}
		const dateOfBirth = minor.dateOfBirth?.trim();
		if (!dateOfBirth) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Enter a date of birth for each minor.'
			});
		}
		if (!isValidIsoDate(dateOfBirth)) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Enter a valid date of birth for each minor.'
			});
		}
		// The signer's calendar day may be a day either side of UTC, so accept the
		// date if it is a minor's birth date on any of those days.
		if (!signingDaysAroundUtc().some((today) => isMinorBirthDate(dateOfBirth, today))) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: `Each minor must be under 18. Check ${fullName}'s date of birth.`
			});
		}
		return { fullName, dateOfBirth };
	});
}

/** Minimum signer age for a stored waiver or version; older records default to 18. */
export function minimumSignerAgeOf(record: { minimumSignerAge?: number }): number {
	return record.minimumSignerAge ?? DEFAULT_MINIMUM_SIGNER_AGE;
}

/**
 * Checks the signer's date of birth on the server. Returns the trimmed date or
 * throws when it is invalid or makes the signer younger than `minimumAge`.
 */
export function validateSignerDateOfBirth(value: string, minimumAge: number): string {
	const dateOfBirth = value.trim();
	if (!isValidIsoDate(dateOfBirth)) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: 'Enter a valid date of birth.'
		});
	}
	// Same one-day tolerance either side of UTC as minors, for the signer's local day.
	if (!signingDaysAroundUtc().some((today) => isSignerBirthDate(dateOfBirth, today, minimumAge))) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: `You must be at least ${minimumAge} to sign this waiver. A parent or guardian can sign and add minors instead.`
		});
	}
	return dateOfBirth;
}

function signingDaysAroundUtc() {
	const dayMs = 24 * 60 * 60 * 1000;
	const now = Date.now();
	return [now - dayMs, now, now + dayMs].map((ms) => new Date(ms).toISOString().slice(0, 10));
}

export function normalizePublicSlug(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 64);
}

export function assertValidPublicSlug(slug: string) {
	if (!PUBLIC_SLUG_REGEX.test(slug)) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: 'Public waiver slug is invalid.'
		});
	}
}
