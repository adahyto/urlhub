# urlhub

Paste links and see them as tiles: the picture, title and description of each page, the duration and channel of
YouTube videos, and what went wrong with a link that could not be read. The address of the page holds the links
(`?urls=...`), so a result can be shared; shared links load by themselves.

Runs on the server at http://51.75.116.68:98 (SvelteKit, adapter-node). Link details come from
[ldb-api](https://github.com/adahyto/ldb-api): the browser posts the links to this app's `/api/json`
(`src/routes/api/json/+server.ts`), and the app's server passes them on to ldb-api at `LDB_API_URL`
(set in `docker-compose.yaml`; without it, the public address of ldb-api).

```sh
npm install
npm run dev       # http://localhost:5173
npm run check     # types
npm run build
```

Deploy on the server: `git pull && sudo docker compose up -d --build`.
