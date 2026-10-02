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

**Share** copies the address of the results. **Short link** keeps the list on the server and copies an address
like `/c/k7Qm2xAb`, which opens the list with its view, option and language (`src/lib/server/collections.ts`): one
JSON file per list in `DATA_DIR` (the `data` volume, `/var/lib/docker/volumes/urlhub_data` on the server, in its
daily backup). Only the links, the view, the option and the language are kept (no address, account or cookie);
the same list always gets the same id; a list nobody opened for 90 days is deleted; 10 short links a minute per
visitor. The notice after the click says so. The dark theme follows the system setting (colours in
`src/app.css`; no switch, which would have to remember the choice on the device).

Recent queries can be remembered on the visitor's device: off by default, turned on with a switch under the
form (`src/lib/history.svelte.ts`). Until then the page stores nothing in the browser, turning it off deletes
the list, and the list is never sent anywhere. Storing on a device needs consent unless the visitor asked for it
(ePrivacy art. 5(3), in Poland art. 399 Prawo komunikacji elektronicznej); the switch is that request, so no
consent banner is needed. The app sets no cookies.

`/status` shows whether urlhub and ldb-api answer, and ldb-api's counts (no links).

Runs on the server at http://51.75.116.68:98 (SvelteKit, adapter-node). Link details come from
[ldb-api](https://github.com/adahyto/ldb-api): the browser posts the text as typed to this app's `/api/json`
(`src/routes/api/json/+server.ts`), and the app's server passes it on to ldb-api at `LDB_API_URL` (set in
`docker-compose.yaml`; without it, the public address of ldb-api). ldb-api finds the links in the text and lists
them on the first line of its answer, so this app has no link finder of its own (`src/lib/query.svelte.ts`).

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
