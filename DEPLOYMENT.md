# Deploy to Vercel without Git

Extract the archive and open a terminal in the `calgary-road-intelligence` folder.

Requirements: Node.js 22+ and a Vercel account. No API keys are required.

```sh
npx vercel login
npx vercel
```

During setup, select your account, create a new project, and use `./` as the project directory. Keep the included Vite settings (build: `npm run build`, output: `dist`). The CLI uploads local files; no Git repository or push is needed.

The first command creates a preview deployment. Check the map, weather filters, automatic evaluation, playback and fullscreen. To publish a production deployment:

```sh
npx vercel --prod
```

## Local verification

```sh
npm ci
npm run build
npm run preview
```

The package includes source files, dependency lockfile, processed traffic/weather snapshots and map style. Raw data and preparation pipelines are omitted; do not run data-refresh commands from this deployment package. Vercel builds the included snapshot as-is.

The map uses key-free OpenFreeMap tiles, glyphs and sprites and needs network access. Application data are bundled locally. Font loading uses Google Fonts with fallback fonts. Analysis runs in the browser, including a Web Worker; no backend or environment variables are needed.

Current builds run `pipelines/compress-data.mjs` before Vite. Include that file when packaging source for Vercel. The output deploys only `dataset.json.gz` and `weather.json.gz`; the app decompresses these assets in the browser, with a fallback for browsers without DecompressionStream. Keep the source JSON files in public/data for build-time compression. Do not manually label an uncompressed response as gzip. Data transfer is approximately 4 MB for the combined 2023–2026 traffic/weather snapshots.
