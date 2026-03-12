# API and WebSocket contract (MVP)

Base URL: `/api` (e.g. `http://localhost:3000/api`).  
Swagger: `/api/docs`.

## Auth

- `POST /api/auth/wechat/login` — Body: `{ code, nickname?, avatar_url? }`. Returns `{ access_token, user }`.
- Protected routes: `Authorization: Bearer <access_token>`.

## Rooms

- `POST /api/rooms` — Create room (owner = caller). Returns `{ roomId, roomCode }`.
- `POST /api/rooms/by-code/:roomCode/join` — Join (body: `{ position? }`). Returns room detail.
- `POST /api/rooms/:roomId/players/virtual` — Add virtual player (body: `{ alias, position }`). Owner only.
- `POST /api/rooms/:roomId/start` — Start game (4 players). Owner only.
- `GET /api/rooms`, `GET /api/rooms/by-code/:roomCode`, `GET /api/rooms/:roomId` — Room list or detail (by-code and by-id are public for spectators).

## Scoring

- `POST /api/rooms/:roomId/score` — 1v1 (body: `{ from_player_id, to_player_id, amount }`). Owner only.
- `POST /api/rooms/:roomId/score/all-in` — 1x3 (body: `{ winner_player_id, base_amount }`). Owner only.
- `POST /api/rooms/:roomId/score/undo` — Undo last log. Owner only. 400 when no log to undo.

All return `{ players: [{ id, currentScore }], lastLog: { id, fromPlayerId, toPlayerId, amount, type } }`.

## Settlement

- `POST /api/rooms/:roomId/finish` — Finish game. Owner only. Returns settlement.
- `GET /api/rooms/:roomId/settlement` — Get settlement (public). Returns `{ roomId, players: [{ playerId, aliasOrName, finalScore, titleKey, titleText, visualHint }] }`.  
  `visualHint`: `winner` | `loser` | `comeback` | `neutral`.

## WebSocket (Socket.io)

- Path: `/ws` (same host).
- Auth: `auth: { token: "<JWT>" }` or query `token`.
- Client → server: `join_room` with payload `{ roomId }`.
- Server → client: `score_updated` — `{ roomId, players, lastLog }`.  
  `room_finished` — `{ roomId, settlementUrl? }`.

## Health

- `GET /api/health` — Returns `{ status: "ok", db: "ok"|"down", redis: "ok"|"down"|"unavailable" }`.
