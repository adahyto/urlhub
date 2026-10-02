/** An SEO warning of a page in advanced answers (ldb-api lib/seo.js) */
export interface SeoWarning {
	/** Stable: "title-too-long", "noindex", ... */
	code: string;
	level: 'error' | 'warning' | 'info';
	/** In English; GUIs translate by code with params */
	message: string;
	/** The numbers and addresses of the message: length, min, max, count, canonical, chain, seconds, limit */
	params?: Record<string, string | number | string[]>;
}

/** One link as ldb-api describes it (see its readme); advanced fields only with advanced: true */
export interface ApiUrl {
	url: string;
	/** page, video, audio, image or other */
	type: string;
	title: string;
	desc: string;
	ogImg: {
		ogImg: string;
		ogImgAlt: string;
	};
	siteName?: string;
	favicon?: string;
	lang?: string;
	/** ISO 8601 when the page's date could be read */
	published?: string;
	author?: string;
	/** Where redirects ended */
	finalUrl?: string;
	/** HTTP status of the page; null when no page was fetched (YouTube, services, unreachable links) */
	status?: number | null;
	responseMs?: number | null;
	/** youtube, vimeo, spotify, soundcloud, tiktok, x, wikipedia, github; '' for pages read directly */
	service?: string;
	/** What only that site has, e.g. GitHub's stars */
	extra?: {
		stars?: number;
		forks?: number;
		language?: string;
		license?: string;
		updatedAt?: string;
		archived?: boolean;
		homepage?: string;
	};
	/** Videos (YouTube, Vimeo, TikTok) */
	channel?: string;
	/** Videos, hh:mm:ss */
	duration?: string;
	/** Why the link could not be read: "timeout", "host not found", "HTTP 404", "video unavailable", ... */
	error?: string;

	// Advanced answers
	keywords?: string;
	ogDesc?: string;
	ogTitle?: string;
	canonical?: string;
	robots?: string;
	urls?: string[];
	htmlTags?: Record<string, string[]>;
	warnings?: SeoWarning[];
}

/** A link in the results: its details, or a placeholder while they are on the way */
export type Row = ApiUrl & { pending?: boolean };

export type View = 'tiles' | 'table' | 'json';

export interface TileUrl {
	url: string;
	type: string;
	title: string;
	desc: string;
	ogImg: {
		src: string;
		alt: string;
	};
	channel: string;
	duration: string;
	error: string;
	/** The site's or shop's name (ldb-api siteName) */
	site?: string;
	/** Still being fetched */
	pending?: boolean;
}
