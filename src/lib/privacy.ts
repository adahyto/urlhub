/**
 * Facts the privacy page states that only the site's operator knows, as on kosmos.info.pl
 * (kosmos app/src/app/core/config/privacy.config.ts). The texts around them are in i18n/{lang}.json under "privacy".
 */
export const PRIVACY = {
	/** Who decides on the processing */
	controller: 'Adam Tomaś',
	/** Where visitors can write about their data */
	contactEmail: 'aex.tomas@gmail.com',
	/** Supervisory authority for complaints */
	authority: {
		pl: 'Prezes Urzędu Ochrony Danych Osobowych (uodo.gov.pl)',
		en: 'the President of the Personal Data Protection Office of Poland, UODO (uodo.gov.pl)'
	},
	/** Date of the last change to this information, YYYY-MM-DD */
	updated: '2026-10-03'
} as const;

/** Shown in the footer copyright, as a link */
export const COPYRIGHT_HOLDER = { name: 'doner.cloud', url: 'https://doner.cloud' } as const;
