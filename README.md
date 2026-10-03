# urlhub

Paste links (or add a .txt file) and see them as **tiles**, a **table** or **JSON**: the picture, title and
description of each page, its site and icon, the author, date and duration of videos (YouTube, Vimeo, TikTok),
GitHub stars, and what went wrong with a link that could not be read. With the advanced option (table and JSON)
each page also gets SEO warnings, keywords, Open Graph, canonical, robots, its links and headings.

The table sorts by title, issues, type or duration, opens each row's details (SEO warnings with their level,
final address, status, canonical, robots, headings, GitHub stars and licence, ...), filters by text, failures,
SEO warnings, type or site, and exports CSV (opens in Excel with Polish letters intact). Failed links can be
fetched again on their own.

The address of the page holds the links, the view and the option (`?urls=...&view=table&advanced=1`), so a
result can be shared; shared links load by themselves. Results fill in as each link is ready; Stop cancels.

The list can be edited without fetching again: × removes a tile or row (with Undo), ← → and ↑ ↓ or dragging
change the order (not while the table is sorted or filtered); the address and the field follow, so Share gives
the edited list.

The interface is in English and Polish (`src/lib/i18n/en.json`, `pl.json`; forms by number through
`Intl.PluralRules`). The language comes from `?lang=pl|en` in the address, otherwise from the browser
(`Accept-Language`, read on the server so the page arrives in it); the PL | EN switch changes `?lang=`. Nothing is
stored on the device. SEO warnings and link errors from ldb-api are translated by their code (warnings with their
`params`). `npm run check` fails when pl.json misses a key of en.json; an end-to-end test compares placeholders.

The page has one column: a header (name, PL | EN), the field with Fetch and **Recent ▾** next to it,
the results with **Share** (a link, or a published page with a title) and **Export ▾** (copy JSON, download JSON or CSV),
and a footer (© doner.cloud, Privacy). `/privacy` is the GDPR information, on the pattern of kosmos.info.pl;
its facts (controller, contact, authority, date) are in `src/lib/privacy.ts`. `/status` is not linked from the
pages. An empty field offers **Try an example**: six working links (YouTube, Vimeo, GitHub, Wikipedia and
kosmos.info.pl in the page's language, Spotify). The duration and issues columns show only when a row fills them.
Menus open with Enter, move with ↑ ↓ and close with Escape (`src/lib/components/Menu.svelte`).

The empty page also offers **featured sets** (`src/lib/featured.json`, read by `src/lib/featured.ts`): ready
lists of links, separate for each language, that open with one click in the view that shows them best (tiles,
or the table for GitHub projects). Six show at first, the rest behind **More sets**. A set with a `season`
(`"MM-DD"` to `"MM-DD"`, may run over the new year) shows only then, first; the day is taken in Poland. Before
adding links, and from time to time after, check them with the real ldb-api on the server:
`npm run featured:check` (ldb-api at `LDB_API_URL`, by default `http://127.0.0.1:84/json`) lists the links that
fail, are blocked by their site or have no picture, and exits with 1 on the first two. With `-- --covers` it also
writes each set's `covers`, the first three pictures of its links (logos skipped), shown across the top of its
card through `/img` at 240 px; run Prettier on `featured.json` after. Charities link only to
their official sites.

**Copy link** (under Share) copies the address of the results. **Short link** keeps the list on the server and copies an address
like `/c/k7Qm2xAb`, which opens the list with its view, option and language (`src/lib/server/collections.ts`): one
JSON file per list in `DATA_DIR` (the `data` volume, `/var/lib/docker/volumes/urlhub_data` on the server, in its
daily backup). Only the links, the view, the option and the language are kept (no address, account or cookie);
the same list always gets the same id; a list nobody opened for 90 days is deleted; 10 short links a minute per
visitor. The notice after the click says so. The dark theme follows the system setting (colours in
`src/app.css`; no switch, which would have to remember the choice on the device).

**Share** opens a dialog (`src/lib/components/ShareDialog.svelte`): first a link to the list as it is, to keep
changing it (the address, a short link, or "Send…", the phone's own sharing, where the browser has it), then
"Publish as a page with a title". A published list (`/l/<id>`, `src/lib/server/lists.ts`) has its title as the
heading, an optional description, tiles or the table, export, copy link and Send…, "Edit a copy" (the links as an
ordinary list) and "Report abuse" (a mailto to the privacy contact, as the DSA asks of hosts). Nobody can change
it: its id comes from its content, so any change makes a new address. The server reads the links' details from
ldb-api when the list is published and keeps that snapshot; details from the browser are not taken. One JSON file
per list in `DATA_DIR/lists`; a list unopened for a year is deleted; 10 a minute per visitor; noindex. To take one
down after a report: `sudo docker compose exec nodeserver rm /data/lists/<id>.json`.

Recent queries can be remembered on the visitor's device: off by default, turned on with a switch under the
form (`src/lib/history.svelte.ts`). Until then the page stores nothing in the browser, turning it off deletes
the list, and the list is never sent anywhere. Storing on a device needs consent unless the visitor asked for it
(ePrivacy art. 5(3), in Poland art. 399 Prawo komunikacji elektronicznej); the switch is that request, so no
consent banner is needed. The app sets no cookies. **Recent** always lists the queries of this visit, kept only
in the page's memory (gone when the tab is closed or reloaded), so the logo, which leads back to the empty home
page, does not lose the list. The home page follows its address: Back and Forward bring a list back or empty it.

For search engines (`src/lib/seo.ts`): the home page and `/privacy` have a canonical address and language
versions (`?lang=pl`, `?lang=en`, x-default without `?lang=`), the home page a JSON-LD `WebApplication`;
results (`?urls=`) are `noindex, follow`; `/sitemap.xml` lists the indexed pages, `/robots.txt` keeps crawlers off
`/api/` and `/c/`. All addresses come from `ORIGIN`.

`/status` shows whether urlhub and ldb-api answer, and ldb-api's counts (no links).

Runs on the server at https://urlhub.cloud (SvelteKit, adapter-node; Cloudflare → Apache → the app on 127.0.0.1:98,
the visitor's address from `X-Forwarded-For`). Link details come from
[ldb-api](https://github.com/adahyto/ldb-api): the browser posts the text as typed to this app's `/api/json`
(`src/routes/api/json/+server.ts`), and the app's server passes it on to ldb-api at `LDB_API_URL` (set in
`docker-compose.yaml`; without it, the public address of ldb-api). ldb-api finds the links in the text and lists
them on the first line of its answer, so this app has no link finder of its own (`src/lib/query.svelte.ts`).

Preview pictures (tiles, the table's thumbnails and favicons) go through this server: `/api/json` adds to each
result the signed addresses of its pictures on `/img` (`src/lib/server/images.ts`), which fetches the picture from
public addresses only, makes it at most 480 px wide (favicons 64 px) as WebP with `sharp`, and keeps it in memory
for a while. The browser shows no picture straight from another site. `IMAGE_PROXY_SECRET` in `.env` signs the
addresses (otherwise a new secret at each start); the end-to-end tests allow 127.0.0.1 with
`IMAGE_PROXY_ALLOW_PRIVATE=1`.

```sh
npm install
npm run dev       # http://localhost:5173
npm run check     # types
npm run build
```

Deploy on the server: `git pull && sudo docker compose up -d --build`.

CI (`.github/workflows/ci.yml`) runs `npm run lint`, `npm run check` and the build on every pull request,
starts the image to check that the page and `/api/json` answer, and runs the end-to-end tests.

End-to-end tests (`tests/e2e/`, Playwright, Chromium) build the app and run it against a fake ldb-api
(`tests/e2e/fake-ldb-api.mjs`: answers from the link's path, `/slow`, `/dead`, `/flaky`, `/video`, ...), so they
need no network and give the same result every time:

```sh
npx playwright install chromium   # once
npm run test:e2e
```
