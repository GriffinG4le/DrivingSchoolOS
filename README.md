# Cutthroat Efficiency

## What this is
- **Backend**: Node + Express API (`src/server.js`)
- **Frontend**: Vite app (`frontend/`)
- **Database**: Postgres (recommended) or SQLite (dev fallback)
- **Supabase**: used for hosting Postgres (and optionally Auth/Storage if you extend it)

## Environment setup
1. Copy `.env.example` to `.env` and fill in values.
2. **Important**:
   - `VITE_SUPABASE_URL` must be your Supabase **project URL** (starts with `https://`), not a Postgres connection string.
   - Use `DATABASE_URL` for your Postgres connection string (Supabase Postgres works here).

## Initialize database
- **Postgres** (recommended):

```bash
npm run db:init
```

This uses `schema.postgres.sql` when `DATABASE_URL` is set (or `DB_CLIENT=postgres`).

- **SQLite** (dev fallback):
Set `DB_CLIENT=sqlite` (and optionally `DB_PATH=...`) then run:

```bash
npm run db:init
```

This uses `schema.sql`.

## Run the API

```bash
npm start
```

## Daraja (M-Pesa) C2B setup
This API already exposes:
- `POST /mpesa/c2b/validation`
- `POST /mpesa/c2b/confirmation`

To register these URLs with Safaricom Daraja (so they start receiving callbacks):
1. Set the Daraja env vars in `.env` (see `.env.example`), especially:
   - `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`
   - `DARAJA_SHORTCODE`
   - `DARAJA_VALIDATION_URL`, `DARAJA_CONFIRMATION_URL`
2. Run:

```bash
npm run daraja:register:c2b
```
