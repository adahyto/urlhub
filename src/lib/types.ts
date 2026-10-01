/** One link as ldb-api describes it */
export interface ApiUrl {
	url: string;
	/** page, video (YouTube), image or other */
	type?: string;
	title: string;
	desc: string;
	ogImg: {
		ogImg: string;
		ogImgAlt: string;
	};
	/** YouTube */
	channel?: string;
	/** YouTube, hh:mm:ss */
	duration?: string;
	/** Why the link could not be read: "timeout", "host not found", "HTTP 404", "video unavailable", ... */
	error?: string;
}

export interface ApiResponse {
	urls: ApiUrl[];
}

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
}
