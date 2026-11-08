/**
 * Multi-language waiver signing.
 *
 * This module is shared by Convex functions and the SvelteKit client, so it must stay
 * free of `$lib` aliases and browser or Node-only APIs.
 *
 * Two kinds of text are translated:
 * - Waiver content (title, intro copy, field labels): written by the workspace owner and
 *   stored as per-locale translations on the waiver and on each published version.
 * - Signing-page chrome (headings, buttons, hints): shipped with the app in
 *   `WAIVER_CHROME_STRINGS` below.
 */

export const WAIVER_LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'it', 'zh', 'ja'] as const;

export type WaiverLocale = (typeof WAIVER_LOCALES)[number];

export const DEFAULT_WAIVER_LOCALE: WaiverLocale = 'en';

/** Native-language names, shown in the signer's language picker. */
export const WAIVER_LOCALE_NATIVE_NAMES: Record<WaiverLocale, string> = {
	en: 'English',
	es: 'Español',
	fr: 'Français',
	de: 'Deutsch',
	pt: 'Português',
	it: 'Italiano',
	zh: '中文',
	ja: '日本語'
};

/** English names, shown to workspace staff in the dashboard. */
export const WAIVER_LOCALE_ENGLISH_NAMES: Record<WaiverLocale, string> = {
	en: 'English',
	es: 'Spanish',
	fr: 'French',
	de: 'German',
	pt: 'Portuguese',
	it: 'Italian',
	zh: 'Chinese (Simplified)',
	ja: 'Japanese'
};

export const MAX_WAIVER_TRANSLATIONS = WAIVER_LOCALES.length - 1;

export function isWaiverLocale(value: unknown): value is WaiverLocale {
	return typeof value === 'string' && (WAIVER_LOCALES as readonly string[]).includes(value);
}

export type WaiverFieldTranslation = {
	id: string;
	label?: string;
	placeholder?: string;
	options?: Array<{ id: string; label: string }>;
};

export type WaiverTranslation = {
	locale: WaiverLocale;
	title: string;
	introCopy: string;
	fields: WaiverFieldTranslation[];
};

type LocalizableField =
	| { id: string; type: 'text'; label: string; required: boolean; placeholder?: string }
	| { id: string; type: 'checkbox'; label: string; required: boolean }
	| {
			id: string;
			type: 'select';
			label: string;
			required: boolean;
			options: Array<{ id: string; label: string }>;
	  }
	| { id: string; type: 'date'; label: string; required: boolean };

type LocalizableWaiver<F extends LocalizableField> = {
	title: string;
	introCopy: string;
	fields: F[];
};

function isBlankHtml(html: string) {
	return (
		html
			.replace(/<[^>]*>/g, '')
			.replace(/&nbsp;/g, ' ')
			.trim().length === 0
	);
}

/**
 * Returns the waiver as a signer sees it in `locale`. Any translated string the owner
 * left blank falls back to the primary-language text, so a partial translation never
 * hides a field or a clause. Field ids, types, and option ids are never changed, so
 * answers stay comparable across languages.
 */
export function localizeWaiver<F extends LocalizableField, W extends LocalizableWaiver<F>>(
	waiver: W,
	translations: readonly WaiverTranslation[] | undefined,
	locale: string | null | undefined
): W {
	const translation = translations?.find((entry) => entry.locale === locale);
	if (!translation) {
		return waiver;
	}

	const fieldTranslations = new Map(translation.fields.map((field) => [field.id, field]));

	return {
		...waiver,
		title: translation.title.trim() || waiver.title,
		introCopy: isBlankHtml(translation.introCopy) ? waiver.introCopy : translation.introCopy,
		fields: waiver.fields.map((field) => {
			const fieldTranslation = fieldTranslations.get(field.id);
			if (!fieldTranslation) return field;

			const label = fieldTranslation.label?.trim() || field.label;
			if (field.type === 'select') {
				const optionLabels = new Map(
					(fieldTranslation.options ?? []).map((option) => [option.id, option.label.trim()])
				);
				return {
					...field,
					label,
					options: field.options.map((option) => ({
						...option,
						label: optionLabels.get(option.id) || option.label
					}))
				};
			}
			if (field.type === 'text') {
				return {
					...field,
					label,
					placeholder: fieldTranslation.placeholder?.trim() || field.placeholder
				};
			}
			return { ...field, label };
		})
	};
}

/** Locales a signer can choose for a waiver: the primary language first, then translations. */
export function availableWaiverLocales(
	defaultLocale: WaiverLocale,
	translations: readonly WaiverTranslation[] | undefined
): WaiverLocale[] {
	const locales: WaiverLocale[] = [defaultLocale];
	for (const translation of translations ?? []) {
		if (!locales.includes(translation.locale)) {
			locales.push(translation.locale);
		}
	}
	return locales;
}

/**
 * Picks the first language the signer is likely to read: an explicit `?lang=` request,
 * then the browser's preferred languages, then the waiver's primary language.
 */
export function pickWaiverLocale(
	available: readonly WaiverLocale[],
	requested: readonly (string | null | undefined)[]
): WaiverLocale {
	for (const candidate of requested) {
		if (!candidate) continue;
		const base = candidate.trim().toLowerCase().split(/[-_]/)[0];
		const match = available.find((locale) => locale === base);
		if (match) return match;
	}
	return available[0] ?? DEFAULT_WAIVER_LOCALE;
}

export type WaiverChromeStrings = {
	language: string;
	booking: string;
	bookedBy: string;
	signedOfExpected: string;
	signerDetails: string;
	fullName: string;
	email: string;
	dateOfBirth: string;
	addMinor: string;
	minorNumber: string;
	remove: string;
	additionalDetails: string;
	selectOne: string;
	stayInTouch: string;
	marketingConsent: string;
	marketingOptional: string;
	signature: string;
	signatureCaptured: string;
	signatureHint: string;
	clear: string;
	submit: string;
	submitting: string;
	submissionReceived: string;
	waiverComplete: string;
	thankYou: string;
	signAnother: string;
	formLoading: string;
	signatureRequired: string;
	submitFailed: string;
	submitted: string;
};

/**
 * App-provided signing-page text. `{name}`-style placeholders are filled by
 * `formatWaiverString`. Non-English strings should be reviewed by a native speaker
 * before they are relied on for legal copy; none of these strings are waiver terms.
 */
export const WAIVER_CHROME_STRINGS: Record<WaiverLocale, WaiverChromeStrings> = {
	en: {
		language: 'Language',
		booking: 'Booking',
		bookedBy: 'Booked by {name}',
		signedOfExpected: '{signed} signed of {expected} expected',
		signerDetails: 'Signer details',
		fullName: 'Full name',
		email: 'Email',
		dateOfBirth: 'Date of birth',
		addMinor: 'Add minor',
		minorNumber: 'Minor {number}',
		remove: 'Remove',
		additionalDetails: 'Additional details',
		selectOne: 'Select one',
		stayInTouch: 'Stay in touch',
		marketingConsent: 'Yes, I would like to receive marketing emails from {workspace}.',
		marketingOptional: 'Optional. You can unsubscribe from marketing emails at any time.',
		signature: 'Signature',
		signatureCaptured: 'Signature captured.',
		signatureHint: 'Draw your signature with a mouse or touch.',
		clear: 'Clear',
		submit: 'Submit waiver',
		submitting: 'Submitting...',
		submissionReceived: 'Submission received',
		waiverComplete: 'Waiver complete',
		thankYou: 'Thank you. Your signed waiver has been recorded for {workspace}.',
		signAnother: 'Sign another waiver',
		formLoading: 'The waiver form is still loading. Please try again.',
		signatureRequired: 'Please provide a signature.',
		submitFailed: 'Unable to submit this waiver.',
		submitted: 'Waiver submitted.'
	},
	es: {
		language: 'Idioma',
		booking: 'Reserva',
		bookedBy: 'Reservado por {name}',
		signedOfExpected: '{signed} firmados de {expected} previstos',
		signerDetails: 'Datos del firmante',
		fullName: 'Nombre completo',
		email: 'Correo electrónico',
		dateOfBirth: 'Fecha de nacimiento',
		addMinor: 'Añadir menor',
		minorNumber: 'Menor {number}',
		remove: 'Quitar',
		additionalDetails: 'Información adicional',
		selectOne: 'Selecciona una opción',
		stayInTouch: 'Mantente en contacto',
		marketingConsent: 'Sí, quiero recibir correos de marketing de {workspace}.',
		marketingOptional:
			'Opcional. Puedes darte de baja de los correos de marketing en cualquier momento.',
		signature: 'Firma',
		signatureCaptured: 'Firma registrada.',
		signatureHint: 'Dibuja tu firma con el ratón o con el dedo.',
		clear: 'Borrar',
		submit: 'Enviar exención',
		submitting: 'Enviando...',
		submissionReceived: 'Envío recibido',
		waiverComplete: 'Exención completada',
		thankYou: 'Gracias. Tu exención firmada ha quedado registrada para {workspace}.',
		signAnother: 'Firmar otra exención',
		formLoading: 'El formulario todavía se está cargando. Inténtalo de nuevo.',
		signatureRequired: 'Por favor, añade tu firma.',
		submitFailed: 'No se pudo enviar esta exención.',
		submitted: 'Exención enviada.'
	},
	fr: {
		language: 'Langue',
		booking: 'Réservation',
		bookedBy: 'Réservé par {name}',
		signedOfExpected: '{signed} signés sur {expected} attendus',
		signerDetails: 'Informations du signataire',
		fullName: 'Nom complet',
		email: 'E-mail',
		dateOfBirth: 'Date de naissance',
		addMinor: 'Ajouter un mineur',
		minorNumber: 'Mineur {number}',
		remove: 'Retirer',
		additionalDetails: 'Informations complémentaires',
		selectOne: 'Choisissez une option',
		stayInTouch: 'Restons en contact',
		marketingConsent: "Oui, j'accepte de recevoir des e-mails marketing de {workspace}.",
		marketingOptional:
			'Facultatif. Vous pouvez vous désabonner des e-mails marketing à tout moment.',
		signature: 'Signature',
		signatureCaptured: 'Signature enregistrée.',
		signatureHint: 'Dessinez votre signature avec la souris ou le doigt.',
		clear: 'Effacer',
		submit: 'Envoyer la décharge',
		submitting: 'Envoi...',
		submissionReceived: 'Envoi reçu',
		waiverComplete: 'Décharge complétée',
		thankYou: 'Merci. Votre décharge signée a été enregistrée pour {workspace}.',
		signAnother: 'Signer une autre décharge',
		formLoading: 'Le formulaire est encore en cours de chargement. Veuillez réessayer.',
		signatureRequired: 'Veuillez signer.',
		submitFailed: "Impossible d'envoyer cette décharge.",
		submitted: 'Décharge envoyée.'
	},
	de: {
		language: 'Sprache',
		booking: 'Buchung',
		bookedBy: 'Gebucht von {name}',
		signedOfExpected: '{signed} von {expected} erwarteten unterschrieben',
		signerDetails: 'Angaben zur unterzeichnenden Person',
		fullName: 'Vollständiger Name',
		email: 'E-Mail',
		dateOfBirth: 'Geburtsdatum',
		addMinor: 'Minderjährige Person hinzufügen',
		minorNumber: 'Minderjährige Person {number}',
		remove: 'Entfernen',
		additionalDetails: 'Weitere Angaben',
		selectOne: 'Bitte auswählen',
		stayInTouch: 'In Kontakt bleiben',
		marketingConsent: 'Ja, ich möchte Marketing-E-Mails von {workspace} erhalten.',
		marketingOptional: 'Optional. Du kannst Marketing-E-Mails jederzeit abbestellen.',
		signature: 'Unterschrift',
		signatureCaptured: 'Unterschrift erfasst.',
		signatureHint: 'Unterschreibe mit der Maus oder dem Finger.',
		clear: 'Löschen',
		submit: 'Verzichtserklärung absenden',
		submitting: 'Wird gesendet...',
		submissionReceived: 'Eingang bestätigt',
		waiverComplete: 'Verzichtserklärung abgeschlossen',
		thankYou: 'Danke. Deine unterschriebene Erklärung wurde für {workspace} gespeichert.',
		signAnother: 'Weitere Erklärung unterschreiben',
		formLoading: 'Das Formular wird noch geladen. Bitte versuche es erneut.',
		signatureRequired: 'Bitte unterschreibe.',
		submitFailed: 'Diese Erklärung konnte nicht gesendet werden.',
		submitted: 'Erklärung gesendet.'
	},
	pt: {
		language: 'Idioma',
		booking: 'Reserva',
		bookedBy: 'Reservado por {name}',
		signedOfExpected: '{signed} assinados de {expected} previstos',
		signerDetails: 'Dados do signatário',
		fullName: 'Nome completo',
		email: 'E-mail',
		dateOfBirth: 'Data de nascimento',
		addMinor: 'Adicionar menor',
		minorNumber: 'Menor {number}',
		remove: 'Remover',
		additionalDetails: 'Informações adicionais',
		selectOne: 'Selecione uma opção',
		stayInTouch: 'Fique em contato',
		marketingConsent: 'Sim, quero receber e-mails de marketing de {workspace}.',
		marketingOptional:
			'Opcional. Você pode cancelar a inscrição nos e-mails de marketing a qualquer momento.',
		signature: 'Assinatura',
		signatureCaptured: 'Assinatura registrada.',
		signatureHint: 'Desenhe sua assinatura com o mouse ou o dedo.',
		clear: 'Limpar',
		submit: 'Enviar termo',
		submitting: 'Enviando...',
		submissionReceived: 'Envio recebido',
		waiverComplete: 'Termo concluído',
		thankYou: 'Obrigado. Seu termo assinado foi registrado para {workspace}.',
		signAnother: 'Assinar outro termo',
		formLoading: 'O formulário ainda está carregando. Tente novamente.',
		signatureRequired: 'Por favor, assine.',
		submitFailed: 'Não foi possível enviar este termo.',
		submitted: 'Termo enviado.'
	},
	it: {
		language: 'Lingua',
		booking: 'Prenotazione',
		bookedBy: 'Prenotato da {name}',
		signedOfExpected: '{signed} firmati su {expected} previsti',
		signerDetails: 'Dati del firmatario',
		fullName: 'Nome e cognome',
		email: 'Email',
		dateOfBirth: 'Data di nascita',
		addMinor: 'Aggiungi minore',
		minorNumber: 'Minore {number}',
		remove: 'Rimuovi',
		additionalDetails: 'Informazioni aggiuntive',
		selectOne: "Seleziona un'opzione",
		stayInTouch: 'Restiamo in contatto',
		marketingConsent: 'Sì, desidero ricevere email di marketing da {workspace}.',
		marketingOptional:
			"Facoltativo. Puoi annullare l'iscrizione alle email di marketing in qualsiasi momento.",
		signature: 'Firma',
		signatureCaptured: 'Firma acquisita.',
		signatureHint: 'Disegna la tua firma con il mouse o con il dito.',
		clear: 'Cancella',
		submit: 'Invia liberatoria',
		submitting: 'Invio in corso...',
		submissionReceived: 'Invio ricevuto',
		waiverComplete: 'Liberatoria completata',
		thankYou: 'Grazie. La tua liberatoria firmata è stata registrata per {workspace}.',
		signAnother: "Firma un'altra liberatoria",
		formLoading: 'Il modulo è ancora in caricamento. Riprova.',
		signatureRequired: 'Inserisci la tua firma.',
		submitFailed: 'Impossibile inviare questa liberatoria.',
		submitted: 'Liberatoria inviata.'
	},
	zh: {
		language: '语言',
		booking: '预订',
		bookedBy: '预订人：{name}',
		signedOfExpected: '已签署 {signed} / 预计 {expected}',
		signerDetails: '签署人信息',
		fullName: '姓名',
		email: '电子邮箱',
		dateOfBirth: '出生日期',
		addMinor: '添加未成年人',
		minorNumber: '未成年人 {number}',
		remove: '移除',
		additionalDetails: '其他信息',
		selectOne: '请选择',
		stayInTouch: '保持联系',
		marketingConsent: '是的，我愿意接收来自 {workspace} 的营销邮件。',
		marketingOptional: '可选。你可以随时退订营销邮件。',
		signature: '签名',
		signatureCaptured: '已记录签名。',
		signatureHint: '请使用鼠标或手指签名。',
		clear: '清除',
		submit: '提交免责声明',
		submitting: '正在提交...',
		submissionReceived: '已收到提交',
		waiverComplete: '免责声明已完成',
		thankYou: '谢谢。你签署的免责声明已为 {workspace} 记录。',
		signAnother: '签署另一份免责声明',
		formLoading: '表单仍在加载，请重试。',
		signatureRequired: '请签名。',
		submitFailed: '无法提交此免责声明。',
		submitted: '免责声明已提交。'
	},
	ja: {
		language: '言語',
		booking: '予約',
		bookedBy: '予約者：{name}',
		signedOfExpected: '署名済み {signed} / 予定 {expected}',
		signerDetails: '署名者情報',
		fullName: '氏名',
		email: 'メールアドレス',
		dateOfBirth: '生年月日',
		addMinor: '未成年者を追加',
		minorNumber: '未成年者 {number}',
		remove: '削除',
		additionalDetails: '追加情報',
		selectOne: '選択してください',
		stayInTouch: '最新情報を受け取る',
		marketingConsent: 'はい、{workspace} からのマーケティングメールを受け取ります。',
		marketingOptional: '任意です。マーケティングメールはいつでも配信停止できます。',
		signature: '署名',
		signatureCaptured: '署名を記録しました。',
		signatureHint: 'マウスまたは指で署名してください。',
		clear: 'クリア',
		submit: '同意書を送信',
		submitting: '送信中...',
		submissionReceived: '送信を受け付けました',
		waiverComplete: '同意書の手続きが完了しました',
		thankYou: 'ありがとうございます。署名済みの同意書は {workspace} に記録されました。',
		signAnother: '別の同意書に署名',
		formLoading: 'フォームを読み込み中です。もう一度お試しください。',
		signatureRequired: '署名してください。',
		submitFailed: 'この同意書を送信できませんでした。',
		submitted: '同意書を送信しました。'
	}
};

export function waiverChromeStrings(locale: string | null | undefined): WaiverChromeStrings {
	return isWaiverLocale(locale)
		? WAIVER_CHROME_STRINGS[locale]
		: WAIVER_CHROME_STRINGS[DEFAULT_WAIVER_LOCALE];
}

export function formatWaiverString(
	template: string,
	values: Record<string, string | number>
): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in values ? String(values[key]) : match
	);
}

/**
 * The marketing opt-in sentence in the signer's language. The server stores exactly this
 * text on the submission, so it must be produced the same way on both sides.
 */
export function localizedMarketingConsentLabel(
	locale: string | null | undefined,
	workspaceName: string
): string {
	return formatWaiverString(waiverChromeStrings(locale).marketingConsent, {
		workspace: workspaceName
	});
}
