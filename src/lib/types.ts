export interface ApiUrl {
	url: string;
	title: string;
	desc: string;
	ogImg: {
		ogImg: string;
		ogImgAlt: string;
	};
}

export interface ApiResponse {
	urls: ApiUrl[];
}

export interface TileUrl {
	url: string;
	title: string;
	desc: string;
	ogImg: {
		src: string;
		alt: string;
	};
}