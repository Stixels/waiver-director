import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { getCurrentUser } from './auth';
import { getWorkspaceMembership } from './workspaces';
import { sanitizeRichTextHtml } from '../../lib/utils/rich-text';

type FunctionCtx = QueryCtx | MutationCtx;
export type TemplateUsageState = 'unusedDraft' | 'publishedNoSubmissions' | 'used';

export const waiverFieldValidator = v.union(
	v.object({
		id: v.string(),
		type: v.literal('shortText'),
		label: v.string(),
		required: v.boolean(),
		placeholder: v.optional(v.string())
	}),
	v.object({
		id: v.string(),
		type: v.literal('longText'),
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

export const waiverDefinitionValidator = v.object({
	title: v.string(),
	introCopy: v.string(),
	fields: v.array(waiverFieldValidator)
});

export const waiverAnswerValueValidator = v.union(v.string(), v.boolean(), v.null());

export const minorInputValidator = v.object({
	fullName: v.string()
});

export type WaiverDefinition = {
	title: string;
	introCopy: string;
	fields: Array<
		| {
				id: string;
				type: 'shortText' | 'longText';
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
};

const PUBLIC_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])$/;
const MAX_FIELDS = 25;
const MAX_SELECT_OPTIONS = 12;
const MAX_MINORS = 50;

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

	const membership = await getWorkspaceMembership(ctx, workspaceId, user._id);
	if (!membership || membership.status !== 'active') {
		throw new ConvexError({
			code: 'forbidden',
			message: 'You do not have access to this workspace.'
		});
	}

	return { user, membership };
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

	if (title.length < 3 || title.length > 120) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: 'Waiver title must be between 3 and 120 characters.'
		});
	}

	if (definition.fields.length > MAX_FIELDS) {
		throw new ConvexError({
			code: 'invalid_argument',
			message: `Limit waivers to ${MAX_FIELDS} custom fields in this release.`
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
		if (label.length < 2 || label.length > 120) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Each field label must be between 2 and 120 characters.'
			});
		}

		if (field.type === 'select') {
			if (field.options.length < 1 || field.options.length > MAX_SELECT_OPTIONS) {
				throw new ConvexError({
					code: 'invalid_argument',
					message: `Select fields require 1-${MAX_SELECT_OPTIONS} options.`
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
					if (optionLabel.length < 1 || optionLabel.length > 80) {
						throw new ConvexError({
							code: 'invalid_argument',
							message: 'Select option labels must be between 1 and 80 characters.'
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

	return {
		title,
		introCopy,
		fields
	};
}

function normalizeWaiverDefinitionForCompare(definition: WaiverDefinition): WaiverDefinition {
	return {
		title: definition.title.trim(),
		introCopy: sanitizeRichTextHtml(definition.introCopy),
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

export function getTemplateUsageState(args: {
	lastPublishedVersionId?: Id<'waiver_template_versions'>;
	hasSubmissions: boolean;
}): TemplateUsageState {
	if (args.hasSubmissions) {
		return 'used';
	}

	if (args.lastPublishedVersionId) {
		return 'publishedNoSubmissions';
	}

	return 'unusedDraft';
}

export function buildTemplateLifecycle(args: {
	template: Doc<'waiver_templates'>;
	activeLink: Doc<'public_waiver_links'> | null;
	hasSubmissions: boolean;
	hasUnpublishedChanges: boolean;
}) {
	const usageState = getTemplateUsageState({
		lastPublishedVersionId: args.template.lastPublishedVersionId,
		hasSubmissions: args.hasSubmissions
	});
	const canDelete = !args.hasSubmissions;
	const isReadOnly = !!args.template.archivedAt;
	const status = isReadOnly
		? 'archived'
		: args.template.lastPublishedVersionId
			? 'published'
			: 'draft';

	return {
		templateId: args.template._id,
		title: args.template.title,
		introCopy: args.template.introCopy,
		status,
		fields: args.template.fields,
		lastPublishedVersionId: args.template.lastPublishedVersionId ?? null,
		isActivePublic:
			!!args.template.lastPublishedVersionId &&
			args.activeLink?.versionId === args.template.lastPublishedVersionId,
		hasUnpublishedChanges: args.hasUnpublishedChanges,
		usageState,
		canDelete,
		canArchive: args.hasSubmissions && !isReadOnly,
		isReadOnly
	};
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

export function validateMinors(minors: MinorInput[]): MinorInput[] {
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
		if (fullName.length < 2 || fullName.length > 120) {
			throw new ConvexError({
				code: 'invalid_argument',
				message: 'Each minor name must be between 2 and 120 characters.'
			});
		}
		return { fullName };
	});
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
