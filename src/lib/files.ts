/** Puts text on the clipboard; navigator.clipboard needs a secure page and permission, so the old way stays */
export async function copyText(content: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(content);
	} catch {
		const area = Object.assign(document.createElement('textarea'), { value: content });
		document.body.append(area);
		area.select();
		document.execCommand('copy');
		area.remove();
	}
}

/** Hands the visitor a file made in the browser */
export function download(content: string, type: string, name: string): void {
	const url = URL.createObjectURL(new Blob([content], { type }));
	Object.assign(document.createElement('a'), { href: url, download: name }).click();
	URL.revokeObjectURL(url);
}
