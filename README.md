# Level Up Barbershop

Booking-first website for **Level Up Barbershop** (Cincinnati, OH): master → services → date/time → confirm, plus master and admin panels.

Stack mirrors Codebridge Studio / Bread by Kat: **React + Vite + TypeScript**, **Express + Prisma**, **MySQL** (not PostgreSQL), EN/RU i18n.

Production target: **https://levelup.codebridgestudio.com**

## Quick start

```bash
# 1. Install
npm run install:all

# 2. MySQL — Homebrew (port 3306) or Docker (`npm run dev:mysql` → port 3307)
cp server/.env.example server/.env
# If using Docker MySQL, set DATABASE_URL host port to 3307 in server/.env

# 3. Schema + seed
npm run db:generate
npm run db:push
npm run db:seed

# 4. Dev (API :3001, Vite :5173)
npm run dev
```

Seeded admin: `admin@levelup.local` / `Admin123!`

## Design

Follow [`DESIGN.md`](./DESIGN.md) — High-Velocity Precision (Oswald / Hanken Grotesk / JetBrains Mono, gold `#f2ca50`, urgent red `#ce0301`, 0px radius). Landing mockup reference: `code.html` / `screen.png`.

## Deploy (subdomain)

1. In cPanel → Domains: create `levelup.codebridgestudio.com` with **Share document root unchecked** and document root `/levelup.codebridgestudio.com` (full path `/home/codensgo/levelup.codebridgestudio.com`).
2. Create MySQL database/user; put `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL=https://levelup.codebridgestudio.com` in `/home/codensgo/levelup-api/.env` on the server.
3. Set up Node.js app (Passenger) with app root `/home/codensgo/levelup-api`, startup `dist/index.js`. Proxy `/api` from the subdomain via `.htaccess` (see `deploy/htaccess.example`).
4. Locally:

```bash
cp .env.deploy.example .env.deploy
npm run deploy:check
npm run deploy:prod
# or: npm run deploy:prod -- --skip-tests
```

SSH uses the existing `namecheap` host from `~/.ssh/config` by default.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | API + client |
| `npm run build` | Production build |
| `npm run test:unit` | Slot/pricing/cancellation unit tests |
| `npm run deploy:prod` | Build, rsync, migrate, smoke |

## Assumptions (v1)

- Pay in-shop (no online payments)
- Email via SMTP when configured; otherwise logged in dev
- Registration required to confirm a booking
- Single location today; `Location` model is multi-location ready
