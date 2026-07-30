// Optional Postgres connection (Neon free tier). If DATABASE_URL isn't
// set, db is null and userStore.js falls back to a local JSON file —
// that keeps local development working before/without a database.

const { Pool, types } = require("pg");

// By default node-postgres parses DATE columns into a JS Date at local
// midnight, which then shifts by a day when later serialized through
// UTC (toISOString()) on any machine whose local timezone is ahead of
// UTC — a real bug caught in health_profiles.last_period_date. DATE
// columns here are only ever read/written as plain "YYYY-MM-DD"
// strings, so skip Date parsing entirely and keep the raw string.
types.setTypeParser(1082, (val) => val);

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

async function initSchema() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      facebook_id TEXT UNIQUE,
      age_range TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      country TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // password_hash is nullable because Google-signed-up accounts have no
  // local password at all. Existing rows already satisfy NOT NULL from
  // the original schema, so this only matters for fresh databases.
  await pool.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_id TEXT UNIQUE`).catch(() => {});
  // Defaults to true (opted in) for everyone, including existing accounts
  // — flipped false via the one-click unsubscribe link in digest emails.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN NOT NULL DEFAULT true`).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipe_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, recipe_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ratings (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipe_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, recipe_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false
    )
  `);

  // Strictly private per-account data, never exposed via the admin
  // dashboard — used only to personalize this user's own suggestions
  // (allergy filtering, concern warnings, cycle-aware timing). Deleting
  // the account cascades here too; users can also clear it directly via
  // DELETE /api/profile/health without deleting their account.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS health_profiles (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_period_date DATE,
      average_cycle_length INTEGER,
      allergies TEXT[] NOT NULL DEFAULT '{}',
      concerns TEXT[] NOT NULL DEFAULT '{}',
      other_notes TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

module.exports = { pool, initSchema };
