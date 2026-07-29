const { pool } = require("./db");

function requireDb() {
  if (pool) return;
  const err = new Error("Health profiles require a database connection (DATABASE_URL not set).");
  err.code = "NO_DB";
  throw err;
}

function rowToProfile(row) {
  if (!row) {
    return { lastPeriodDate: null, averageCycleLength: null, allergies: [], concerns: [], otherNotes: "" };
  }
  return {
    lastPeriodDate: row.last_period_date || null,
    averageCycleLength: row.average_cycle_length,
    allergies: row.allergies || [],
    concerns: row.concerns || [],
    otherNotes: row.other_notes || ""
  };
}

async function getProfile(userId) {
  requireDb();
  const { rows } = await pool.query("SELECT * FROM health_profiles WHERE user_id = $1", [userId]);
  return rowToProfile(rows[0]);
}

async function upsertProfile(userId, { lastPeriodDate, averageCycleLength, allergies, concerns, otherNotes }) {
  requireDb();
  const { rows } = await pool.query(
    `INSERT INTO health_profiles (user_id, last_period_date, average_cycle_length, allergies, concerns, other_notes, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (user_id) DO UPDATE SET
       last_period_date = EXCLUDED.last_period_date,
       average_cycle_length = EXCLUDED.average_cycle_length,
       allergies = EXCLUDED.allergies,
       concerns = EXCLUDED.concerns,
       other_notes = EXCLUDED.other_notes,
       updated_at = now()
     RETURNING *`,
    [userId, lastPeriodDate || null, averageCycleLength || null, allergies || [], concerns || [], otherNotes || ""]
  );
  return rowToProfile(rows[0]);
}

async function clearProfile(userId) {
  requireDb();
  await pool.query("DELETE FROM health_profiles WHERE user_id = $1", [userId]);
}

module.exports = { getProfile, upsertProfile, clearProfile };
