# WebCraft dedicated server · 100-player target

This release adds a Node.js game process for cooperative survival and creative worlds, independently of a player's browser. The process admits **100 connections total across both worlds**. Existing 4-player friend rooms keep their current transport.

The server and its hosting files are prepared for deployment. **A public dedicated server has not been provisioned yet.** GitHub Pages alone cannot run this process.

## Player names

- Signed-in accounts choose a persistent **English nickname**, 3–16 ASCII letters, numbers or underscores, starting with a letter. Names are unique without case distinctions. Leave the server before changing a name.
- `Guest`, `Guest1`, `Guest2`, and other `Guest` + digits names are reserved. Guests receive `Guest1`, `Guest2`, … from a durable database counter; names never come from a URL or editable guest field.
- Returning guests retain their name while their guest session remains valid. Sessions renew during play. Creating a guest does not create an anonymous Supabase Auth user.
- The backend verifies account access tokens against the existing Supabase Auth user endpoint. It does not trust client user IDs or `user_metadata`. Only opaque game session hashes are stored in the database.
- The existing account-only credit controls are unchanged. The dedicated server never awards credits.

## Recommended first host: Render

Use the included [render.yaml](../render.yaml): **1 CPU / 2 GB RAM (`1c-2g`), Singapore, one instance, and a 1 GB persistent disk**. The game process runs without root privileges after the mounted data directory is initialized. Automatic deployments are disabled.

As checked on **2026-11-09**, Render lists this compute plan at **US$25/month** and persistent disks at **US$0.25/GB/month**. The compute + 1 GB disk baseline is **US$25.25/month**, excluding bandwidth, taxes and other account services. Review the current [Render pricing](https://render.com/pricing) before provisioning. No hosting subscription or paid resource has been created by this change.

1. Open the Render dashboard, create a **Blueprint**, and connect this GitHub repository. Until the change is merged, select the `feat/public-servers-1100` branch containing `render.yaml`.
2. Review the plan and disk cost, then deploy. Keep the disk mounted at `/data` and the instance count at one.
3. After Render reports the service healthy, open `https://<your-service>.onrender.com/servers.html`. The service serves both the game and its API. Its Render origin is allowed automatically.
4. Sign in at that address to choose a nickname, or continue as a numbered guest. Account sessions are scoped to each website origin. For sign-up confirmation links that return directly to this host, add its `auth.html` URL to the Supabase Auth redirect allowlist.
5. To use the existing GitHub Pages frontend, set `apiBase` in [js/server-config.js](../js/server-config.js) to the service's HTTPS origin, then deploy that reviewed frontend update. The GitHub Pages origin is already allowed by `render.yaml`.

The service's `/health` endpoint returns deployment version, occupancy and health. `/api/servers` supplies the lobby counts. If storage fails, the affected world stops accepting actions and health reports failure.

A disk-backed single instance is intentional: scaling the same deployment horizontally would require a shared simulation coordinator and storage. The SQLite counter, nickname registry, world state and operation journal live together on the persistent disk. Preserve and back up that disk before recreating the service.

## Run locally

Requires **Node.js 24**. The Docker image pins Node.js 24.22.1 and the WebSocket package is locked to an exact version.

```sh
npm ci --prefix server
npm test
npm run server
```

Open `http://localhost:8080/servers.html`. The default API origin is the current page origin. To use another development origin, explicitly add it to `ALLOWED_ORIGINS`.

```sh
docker compose up --build -d
```

The named Docker volume retains names, guest numbers and worlds after a container restart. `docker compose down` preserves that volume; keep it when upgrading. A VPS needs HTTPS and WebSocket forwarding in front of port 8080, plus its public origin in `ALLOWED_ORIGINS`.

| Setting | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP and WebSocket port |
| `MAX_PLAYERS` | `100` | Total occupancy, bounded from 1 to 100 |
| `DATA_FILE` | `server/data/webcraft.sqlite` | Persistent database; `/data/webcraft.sqlite` in Docker/Render |
| `ALLOWED_ORIGINS` | GitHub Pages and local port 8080 | Exact allowed browser origins, comma separated |
| `TRUST_PROXY` | off | Use a trusted reverse proxy's client IP for identity rate limits |

No Supabase service-role key is needed. The existing publishable key is used only with the player's access token to verify account identity. Database files, tokens and local runtime data must not be committed or placed on GitHub Pages.

## Simulation and persistence

The dedicated process reuses the production terrain generator, block interactions, mobs, arrows, drops, farming, furnaces and container rules. Clients share changes with nearby players. Rendering is bounded to the nearest 24 other players while occupancy can reach 100.

Shared mutations are journaled with their operation results in atomic SQLite transactions before replies are sent. A short group-commit window combines concurrent requests. Duplicate retries and token renewal retain the same operation identity. Periodic checkpoints compact the journal; nearby region snapshots avoid sending the entire edited world to every player. Block chunks have a bounded server cache.

The simulation idles when a world has no players; the process and saved world remain available.

Blocks, doors, crops, storage, time and drops survive restart. Mob populations regenerate after restart. Personal inventory, crafting state and survival values retain the existing client simulation and are saved as validated checkpoints scoped to each identity. This release does not provide competitive anti-cheat. It has no PvP or chat.

## Validation

```sh
npm test
npm run loadtest
LOAD_TEST_MS=30000 npm run loadtest
```

The load test opens 100 separate WebSocket connections against the actual server, with 50,000 pre-existing edited cells. Every client sends movement and performs world edits. It checks successful changes, round-trip latency, frame limits and rejection of player 101. This is a loopback protocol benchmark; production internet latency and 100 simultaneous WebGL browsers still need measurement on the selected host.

A local 30-second run on Node.js 24.22.1 admitted 100 clients into a world with 50,000 existing edits, handled 23,800 movement messages and 2,900 successful edits, and rejected player 101. Edit round-trip p95 was 21.65 ms, peak recorded tick work was 16.54 ms, and process RSS was 330 MiB. The 100 clients received 42.79 MiB in aggregate. These measurements describe this test environment, rather than a production-host guarantee.

Additional tests cover verified login, reserved and duplicate nicknames, guest counter persistence, session renewal, reconnection, concurrent mining, in-flight duplicate requests, atomic journal recovery, private files and cross-origin access. Browser visual/input QA is separate from these automated tests.
