import type { View } from './types';

/*
 * Recent queries, kept in this browser's localStorage only when the visitor turns it on. Storing anything on the
 * visitor's device needs consent unless the visitor asked for it (ePrivacy art. 5(3); in Poland art. 399 of
 * Prawo komunikacji elektronicznej): so nothing at all is written until the switch is turned on (not even "off"),
 * turning it off deletes everything, and nothing here is ever sent to a server.
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

	/** Reads what is stored; call in the browser (onMount) */
	load(): void {
		try {
			const raw = localStorage.getItem(KEY);
			this.available = true;
			this.enabled = raw !== null;
			const parsed = raw ? JSON.parse(raw) : [];
			this.entries = Array.isArray(parsed)
				? parsed.filter((e) => Array.isArray(e?.urls) && typeof e.at === 'number').slice(0, MAX)
				: [];
		} catch {
			this.available = false;
			this.enabled = false;
			this.entries = [];
		}
	}

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

	/** Puts a query on top (the same list of links only once); does nothing unless turned on */
	add(urls: string[], view: View, advanced: boolean): void {
		if (!this.enabled || !urls.length) return;
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
