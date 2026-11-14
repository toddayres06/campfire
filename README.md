# Campfire

A personal road companion built from the original Campfire Journey → Leg → Destination model. This MVP focuses on a map, a travel companion, a photo journal, a fifty-state collection, and a simple gig-work log.

## Run

Requires Node.js 20.9+ and npm.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local`. Add a Mapbox public token for interactive maps.
3. Run `npm run dev` and open http://localhost:3000.

For production: `npm run build`, then `npm start`. Production mode registers the offline service worker. Use HTTPS for installation, camera/location features, and service workers on a phone. Localhost works on the development computer. A phone's localhost is the phone itself.

## What works

- Animated Mapbox journey reveal, generous leg tap targets, leg camera focus, destination focus, full-journey reset, keyboard-accessible destination markers, and graceful map failure states.
- Original Texas-to-Virginia itinerary retained as a **starter plan**, not asserted as actual travel history. Add, edit, or remove stops; choose a current stop; optionally request GPS once. Map lines are itinerary connections. Directions open your navigation app through Google Maps.
- Journal entries with title, date, place, state, notes, and a photo. Photos are resized to a maximum dimension of 1600 px, converted to JPEG, and stored locally. Edit or delete a memory and search the journal.
- Toggle all fifty states in a collection. Photos of welcome signs or landmarks belong in the journal; no license-plate recognition or automatic state claims.
- Work shifts with platform, city, date, hours, earnings, and fuel. Compare recorded earnings after fuel per hour across cities. This does not estimate taxes or full vehicle costs, or predict gig demand.
- Live National Weather Service forecasts and point-based active alerts with timestamps, source links, and explicit unavailable states. Alert failures never become an all-clear. These are **on-demand point checks**, not corridor monitoring or push notifications.
- Nearby gas, affordable-food, and park searches open Google Maps. They are search links, not a live price/deal feed.
- Companion conversation uses server-side OpenAI Responses API and web search when `OPENAI_API_KEY` and `OPENAI_MODEL` are configured. Trip context includes the current stop, planned route, preferences, states, recent memory text, and recent work records. Photos are not sent. Responses link their sources. Chat history lasts for the page session.
- Without AI credentials, clearly labeled trip-tools mode still retrieves real weather and offers the appropriate trip tools. It does not pretend to be an AI model.
- Local IndexedDB persistence, visible save status, JSON backup export/import with validation, responsive phone layout, install manifest/icons, and offline shell in production.

## Storage and sharing

Trip data and photos live in this browser's IndexedDB. Clearing site data or changing browsers/origins removes access to that copy. Use **Settings & backup → Export backup** regularly. Restore a backup on another device with **Import backup**; imports replace the destination copy after confirmation.

There is no automatic cloud sync, shared account, or server photo storage in this iteration. This is suitable for a personal, device-local MVP. A shared two-person account and cloud backups need a hosted database, object storage, and authentication before claiming cross-device reliability.

The offline shell is cached after a successful production installation. Maps, weather, AI, and external search need a connection. Background location, server monitoring, and push notifications are not implemented.

## AI and hosting

The original checkout supplied a local Mapbox public token. It is kept in ignored `.env.local` and excluded from source archives and commits. No OpenAI API key was found or generated.

Set these on your server:

```text
NEXT_PUBLIC_MAPBOX_TOKEN=your_public_mapbox_token
OPENAI_API_KEY=your_server_only_api_key
OPENAI_MODEL=your_web_search_capable_model
```

Choose a currently available Responses/web-search compatible model in your OpenAI account. The model is deliberately configurable rather than hardcoded. Keep `OPENAI_API_KEY` server-side. The AI route is same-origin and bounded by request size and output tokens; this personal MVP does not include shared-user authentication or distributed rate limiting. Use private hosting access before enabling AI on a remote deployment.

The app retains Next.js 16.3 from the existing repository. Deploy on a host that supports this Next.js version and server route handlers (for example an existing compatible Node deployment). No public deployment, domain change, or merge into main was performed. Sites hosting would require an explicit supported server build adaptation; no incompatible static build is presented as a hosted app.

## Validation

```text
npm test
npm run lint
npm run build
```

Tests cover malformed backups, unsafe photo URLs, invalid coordinates, invalid work logs, and a complete IndexedDB/photo/collection/work-record round trip. Browser verification covers journal creation and reload, state collection, shift calculations, stop creation, destination focus, live weather and companion tools mode, backup export, and phone-width rendering. The AI-enabled path requires an API key and was not exercised. Physical iPhone installation and remote hosting were not exercised.

## API references

- [Next.js local bundled documentation](node_modules/next/dist/docs/index.md) — read before implementation as required by AGENTS.md.
- [NWS API documentation](https://www.weather.gov/documentation/services-web-api)
- [OpenAI Responses web search](https://developers.openai.com/api/docs/guides/tools-web-search?api-mode=responses)
- [Mapbox GL JS documentation](https://docs.mapbox.com/mapbox-gl-js/)
