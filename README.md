# urlhub

Paste links (or add a .txt file) and see them as **tiles**, a **table** or **JSON**: the picture, title and
description of each page, its site and icon, the author, date and duration of videos (YouTube, Vimeo, TikTok),
GitHub stars, and what went wrong with a link that could not be read. With the advanced option (table and JSON)
each page also gets SEO warnings, keywords, Open Graph, canonical, robots, its links and headings.

The address of the page holds the links, the view and the option (`?urls=...&view=table&advanced=1`), so a
result can be shared; shared links load by themselves. Results fill in as each link is ready; Stop cancels.

`/status` shows whether urlhub, ldb-api and ldb-gui answer, and ldb-api's counts (no links).

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

CI (`.github/workflows/ci.yml`) runs `npm run lint`, `npm run check` and the build on every pull request, and
starts the image to check that the page and `/api/json` answer.
