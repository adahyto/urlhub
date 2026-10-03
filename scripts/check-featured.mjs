// Checks the links of the featured sets (src/lib/featured.json) with ldb-api, the way the home page will show them,
// and lists the ones that fail, are blocked by their site (shops, bot protection) or come without a picture.
// Run it on the server, where ldb-api is, before adding links and from time to time after:
//
//   npm run featured:check                 (ldb-api at LDB_API_URL, by default http://127.0.0.1:84/json)
//
// Exits with 1 when a link fails or is blocked; a missing picture is only reported (the tile still works).
import { readFile } from 'node:fs/promises';

const API = process.env.LDB_API_URL || 'http://127.0.0.1:84/json';
const BATCH = 200;

const sets = JSON.parse(
	await readFile(new URL('../src/lib/featured.json', import.meta.url), 'utf8')
);
const urls = [...new Set(sets.flatMap((set) => set.urls))];

const results = new Map();
for (let i = 0; i < urls.length; i += BATCH) {
	const batch = urls.slice(i, i + BATCH);
	const res = await fetch(API, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ urls: batch })
	});
	if (!res.ok) throw new Error(`ldb-api answered ${res.status}: ${await res.text()}`);
	const answer = await res.json();
	answer.urls.forEach((result, index) => results.set(batch[index], result));
}

let broken = 0;
let pictureless = 0;
for (const set of sets) {
	const problems = set.urls.flatMap((url) => {
		const result = results.get(url);
		if (!result) return [`missing  ${url}`];
		if (result.error) return [`${result.error.padEnd(8)} ${url}`];
		if (!result.ogImg?.ogImg) return [`no image ${url}  (${result.title || 'no title'})`];
		return [];
	});
	const failing = problems.filter((p) => !p.startsWith('no image')).length;
	broken += failing;
	pictureless += problems.length - failing;
	const mark = failing ? 'FAIL' : problems.length ? 'ok* ' : 'ok  ';
	console.log(`${mark} ${set.lang}/${set.id} (${set.urls.length} links)`);
	for (const problem of problems) console.log(`       ${problem}`);
}

console.log(
	`\n${urls.length} links checked: ${broken} failing or blocked, ${pictureless} without a picture`
);
process.exitCode = broken ? 1 : 0;
