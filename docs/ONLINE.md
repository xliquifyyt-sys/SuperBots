# Online play

Super Bots stays one web codebase. `npm start` serves the game, accounts, friends, and the match server. A later Capacitor wrap is the Android and iOS app: it loads this same site and posts Google or Apple tokens to the same endpoints. Offline custom games and Quick 1v1 do not need the server.

## Why this stack

Node, the `ws` WebSocket library, and one SQLite file (`node:sqlite`, Node 22).

- The sim already runs in Node. The server imports `src/core/match.js` and is the authority.
- SQLite is a single file. There is no database bill and nothing to provision for a first launch. One process hosts every live lobby, which matches a small indie game.
- Google and Apple are optional. Guest accounts are enough to develop and to play on a LAN.
- When one machine is not enough, move the same tables to Postgres. Live matches stay in memory on one process either way, because both clients must share one sim.

## How a match stays in sync

The host's lobby picks the settings, the roster, and a seed. Every client builds a `Match` from those same inputs. During the plan phase each human sends aim updates and, if they lock, a FIRE. When the plan timer ends, the server uses the current aim, or skip if they never aimed. It resolves the turn with the real sim, then broadcasts the action list. Clients play that list back through the same sim, so the pictures match. After each turn the server sends a short fingerprint of hit points and positions. A client that disagrees logs it. Reconnecting during a match replays the action history and joins the live phase.

If a socket drops, that bot becomes AI for the turns they miss. Reconnecting replays the history and hands control back. Leaving the match on purpose also hands the bot to the AI.

## Accounts and friends

- `POST /api/auth/guest` with a unique username. This is the dev and local login.
- `POST /api/auth/google` with `{ idToken }` once `GOOGLE_CLIENT_ID` is set.
- `POST /api/auth/apple` with `{ identityToken }` once `APPLE_CLIENT_ID` is set. The signature is checked against Apple's published keys.
- Usernames are 3–16 letters, numbers, or underscores. Each profile has a friend code, wins, losses, and games.
- Friends: request by username or friend code, accept, decline, remove. Presence is online, in a lobby, in a match, or offline.
- A lobby invite is an in-game notification. The same row is stored with `delivered_push = 0`. A future worker can call `pendingPush()` and send FCM or APNs, then `markPushed()`. No push provider is wired up yet.

## Run it locally

```bash
npm install
npm start
```

Open http://localhost:8080. Play Online, pick a username, create a lobby, and invite a friend from a second browser or another device on the same network.

`npm run offline` is the old static server on port 8000. Quick 1v1 and Custom Game work there. Play Online will not, because there is no account server.

```bash
npm run test:online          # two scripted clients, friends, invite, full match, reconnect
npm run test:online-browser # two Chrome windows through the real menus
```

## Deploy

Any small Node 22 host works. A $5 VPS, Fly.io, or Railway is enough.

1. Clone the repo on the server.
2. `npm install --omit=dev` is not enough for the browser test, but production only needs `ws`. Install with `npm install`.
3. Copy `.env.example` to `.env`. Set `PORT` and, when you have them, the Google and Apple client ids.
4. Put `server/data` on a persistent disk so accounts survive a restart.
5. Put a TLS reverse proxy (Caddy or nginx) in front. Browsers need `https` and `wss` once you leave localhost. The client uses the page's own host for the socket.
6. Run `node server/index.js` under systemd or the host's process manager.

Live lobbies vanish on restart. Accounts, friends, and the notification queue are in SQLite and come back.

## What you need to create

Nothing, to play with guest accounts.

For Google, in Google Cloud Console create an OAuth client (Web, and later Android and iOS) and set `GOOGLE_CLIENT_ID` to the web client id. The native apps obtain an ID token and `POST` it to `/api/auth/google`. On the web, the page uses Google Identity Services if that script is added and the client id is set.

For Apple, create a Services ID and set `APPLE_CLIENT_ID`. The Capacitor Sign in with Apple plugin posts the identity token to `/api/auth/apple`.

Do not commit `.env` or `server/data`.

## Left for later

- App Store / Play wrapper (Capacitor) and the native Google and Apple buttons.
- Mobile push (the notification table is the queue).
- Ranked matchmaking, chat, and more than one match process.
- Moving SQLite to Postgres if the account file ever needs more than one server.
