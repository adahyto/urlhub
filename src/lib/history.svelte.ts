import type { View } from './types';

/*
 * Recent queries. The queries of this visit are kept in the page's memory, so Recent can take the visitor back
 * to a list after the logo or another list; nothing is written on the device for that, and they are gone when
 * the tab is closed or reloaded. They are kept in this browser's localStorage only when the visitor turns it on.
 * Storing anything on the visitor's device needs consent unless the visitor asked for it (ePrivacy art. 5(3); in
 * Poland art. 399 of Prawo komunikacji elektronicznej): so nothing at all is written until the switch is turned on
 * (not even "off"), turning it off deletes everything, and nothing here is ever sent to a server.
 * Every access may throw (private windows, blocked site data): the feature then simply is not offered.
 */

const KEY = 'urlhub.recent';
const MAX = 20;

export interface Recent {
	/** Time of the query, ms since 1970 */
	at: number;
	urls: string[];
	view: View;
	advanced: boolean;
}

export class RecentQueries {
	/** Whether this browser lets the page store anything (false until checked in the browser) */
	available = $state(false);
	/** Turned on by the visitor: the key exists */
	enabled = $state(false);
	entries = $state<Recent[]>([]);

	#loaded = false;

	/** Reads what is stored, once per visit; call in the browser (onMount) */
	load(): void {
		if (this.#loaded) return;
		this.#loaded = true;
		try {
			const raw = localStorage.getItem(KEY);
			this.available = true;
			this.enabled = raw !== null;
			const parsed = raw ? JSON.parse(raw) : [];
			const stored: Recent[] = Array.isArray(parsed)
				? parsed.filter((e) => Array.isArray(e?.urls) && typeof e.at === 'number')
				: [];
			this.entries = [...this.entries, ...stored].slice(0, MAX);
		} catch {
			this.available = false;
			this.enabled = false;
		}
	}

	/** Turning it on keeps this visit's queries too; turning it off deletes them all */
	setEnabled(on: boolean): void {
		this.enabled = on;
		if (!on) this.entries = [];
		try {
			if (on) localStorage.setItem(KEY, JSON.stringify(this.entries));
			else localStorage.removeItem(KEY);
		} catch {
			this.available = false;
			this.enabled = false;
		}
	}

	/** Puts a query on top (the same list of links only once); stored on the device only when turned on */
	add(urls: string[], view: View, advanced: boolean): void {
		if (!urls.length) return;
		const same = (e: Recent) =>
			e.urls.length === urls.length && e.urls.every((u, i) => u === urls[i]);
		this.entries = [
			{ at: Date.now(), urls, view, advanced },
			...this.entries.filter((e) => !same(e))
		].slice(0, MAX);
		this.#save();
	}

	remove(entry: Recent): void {
		this.entries = this.entries.filter((e) => e !== entry);
		this.#save();
	}

	clear(): void {
		this.entries = [];
		this.#save();
	}

	#save(): void {
		if (!this.enabled) return;
		try {
			localStorage.setItem(KEY, JSON.stringify(this.entries));
		} catch {
			// Full or blocked: the list stays for this visit only
		}
	}
}

/**
 * One list for the whole visit, so it survives going to another page and back. Only the browser changes it
 * (load and add run from the page's events), so the server never holds anyone's queries.
 */
export const recent = new RecentQueries();
