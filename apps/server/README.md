<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

极速记分小程序 (Avocado Scorer) MVP 服务端 — NestJS + TypeORM + PostgreSQL + Redis + WebSocket.

## Project setup

```bash
$ pnpm install
```

## Local development

1. Copy env and set variables:
   ```bash
   cp .env.example .env
   # Edit .env: DATABASE_URL, REDIS_URL, WECHAT_APPID, WECHAT_SECRET
   ```
2. Ensure PostgreSQL and Redis are running; create DB if needed.
3. Run migrations:
   ```bash
   pnpm run migration:run
   ```
4. Start server:
   ```bash
   pnpm run dev
   ```
5. API base: `http://localhost:3000/api`; Swagger: `http://localhost:3000/api/docs`.

From monorepo root: `pnpm --filter server dev` or `pnpm -r run dev` (runs all apps).

### Phase 1 manual test (rooms + auth)

1. Start server and ensure DB + Redis (optional) are up; run migrations.
2. **Login**: `POST /api/auth/wechat/login` with body `{ "code": "<wx code>" }` (use WeChat dev tools or mock).
3. **Create room**: `POST /api/rooms` with `Authorization: Bearer <token>`; note `roomId` and `roomCode`.
4. **Join**: `POST /api/rooms/by-code/<roomCode>/join` with same token (optional body `{ "position": 1 }`).
5. **Add virtual**: `POST /api/rooms/<roomId>/players/virtual` with body `{ "alias": "替身", "position": 2 }`.
6. **Start**: `POST /api/rooms/<roomId>/start` (need 4 players total).
7. **Get room**: `GET /api/rooms/by-code/<roomCode>` or `GET /api/rooms/<roomId>` (no auth for spectator).

### Phase 2: Scoring and WebSocket

- **1v1 score**: `POST /api/rooms/:roomId/score` body `{ "from_player_id", "to_player_id", "amount" }` (owner only).
- **All-in (1x3)**: `POST /api/rooms/:roomId/score/all-in` body `{ "winner_player_id", "base_amount" }`.
- **Undo**: `POST /api/rooms/:roomId/score/undo` (owner only). Returns 400 when no log to undo.
- **WebSocket**: Connect to `/ws` (path on same host). Auth: `auth: { token: "<JWT>" }` or `query.token`. Event `join_room` payload `{ roomId }` to subscribe. Server emits `score_updated` and `room_finished`.

### Phase 3: Settlement and poster

- **Finish game**: `POST /api/rooms/:roomId/finish` (owner, JWT). Returns settlement with `players[]` (finalScore, titleKey, titleText, visualHint). Emits `room_finished` on WebSocket.
- **Settlement data**: `GET /api/rooms/:roomId/settlement` (public). Same structure for poster Canvas. visualHint: `winner` | `loser` | `comeback` | `neutral`.

### Phase 4: Performance and ops

- **Redis**: Room scores cached at `room:{id}:scores` after each score/undo; sync write to PostgreSQL. Optional: on startup, hydrate Redis from DB for rooms in `playing` state.
- **Lock**: All-in and concurrent score use `RedisService.withLock(roomId)` to avoid race.
- **Health**: `GET /api/health` returns `db` and `redis` status for probes.
- **Tests**: Unit tests `pnpm test`; e2e `pnpm test:e2e` (may require DB). Boundary: undo until empty, all-virtual room, 2-player room.

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run dev
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
