# Database Setup

LateWiz uses **MySQL 8+** with **Drizzle ORM**.

## Prerequisites

- MySQL 8.0 or later
- Node.js 20+

## 1. Create the MySQL database

```sql
CREATE DATABASE latewiz CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'latewiz'@'localhost' IDENTIFIED BY 'your_password_here';
GRANT ALL PRIVILEGES ON latewiz.* TO 'latewiz'@'localhost';
FLUSH PRIVILEGES;
```

Or keep using root locally — just update `.env.local`.

## 2. Update .env.local

```env
DATABASE_URL="mysql://latewiz:your_password_here@localhost:3306/latewiz"
JWT_SECRET="run: openssl rand -base64 32"
```

## 3. Install dependencies

```bash
npm install
```

## 4. Push schema to the database

```bash
npm run db:push
```

This creates all tables. Run it again after any schema change.

## 5. (Optional) Open Drizzle Studio

```bash
npm run db:studio
```

Launches a browser GUI at http://localhost:4983 to inspect data.

## Running the worker

The worker processes background jobs (AI generation, publishing).
Run it in a separate terminal:

```bash
npm run worker
```

In production, run it as a separate process alongside `npm start`.
Use a process manager (PM2, systemd, Docker) to keep it alive.

## Schema overview

| Table               | Purpose                                         |
|---------------------|-------------------------------------------------|
| users               | LateWiz accounts (keyed by Zernio API key)      |
| workspaces          | Tenant boundary; maps to a Zernio profile       |
| brands              | Brand profiles (migrated from localStorage)     |
| calendar_entries    | Planned posts managed by LateWiz                |
| jobs                | Durable async job queue                         |
| autopilot_configs   | Per-brand Autopilot settings                    |
| publishing_results  | Audit log of every publish attempt              |

## Migrating existing brands from localStorage

After logging in, call:

```bash
POST /api/brands/migrate
Body: { brands: [...] }   # paste from localStorage["latewiz-brands"]
```

The app will do this automatically on first login (to be wired into the
auth flow in a future step).
