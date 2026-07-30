// Mirrors resetTokenStore.js — a single-use, expiring token proving
// control of the email address used to sign up.
const crypto = require("crypto");
const { pool } = require("./db");

function requireDb() {
  if (pool) return;
  const err = new Error("Email verification requires a database connection (DATABASE_URL not set).");
  err.code = "NO_DB";
  throw err;
}

async function createVerificationToken(userId) {
  requireDb();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await pool.query(
    "INSERT INTO email_verification_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt]
  );
  return token;
}

async function consumeVerificationToken(token) {
  requireDb();
  const { rows } = await pool.query("SELECT * FROM email_verification_tokens WHERE token = $1", [token]);
  const record = rows[0];
  if (!record) return { valid: false, reason: "not_found" };
  if (record.used) return { valid: false, reason: "used" };
  if (new Date(record.expires_at) < new Date()) return { valid: false, reason: "expired" };

  await pool.query("UPDATE email_verification_tokens SET used = true WHERE token = $1", [token]);
  return { valid: true, userId: record.user_id };
}

module.exports = { createVerificationToken, consumeVerificationToken };
