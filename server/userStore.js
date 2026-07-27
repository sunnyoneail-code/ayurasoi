const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pool } = require("./db");

const DATA_PATH = path.join(__dirname, "data", "users.json");

// --- File-based fallback (used only when DATABASE_URL isn't set) ---

function readUsersFile() {
  if (!fs.existsSync(DATA_PATH)) return [];
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
}

function writeUsersFile(list) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(list, null, 2), "utf-8");
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash ?? row.passwordHash ?? null,
    googleId: row.google_id ?? row.googleId ?? null,
    demographics: {
      ageRange: row.age_range ?? row.demographics?.ageRange ?? "",
      gender: row.gender ?? row.demographics?.gender ?? "",
      country: row.country ?? row.demographics?.country ?? ""
    },
    createdAt: row.created_at || row.createdAt
  };
}

async function findByEmail(email) {
  if (pool) {
    const { rows } = await pool.query("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
    return rowToUser(rows[0]);
  }
  const list = readUsersFile();
  return list.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

async function findById(id) {
  if (pool) {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return rowToUser(rows[0]);
  }
  const list = readUsersFile();
  return list.find((u) => u.id === id) || null;
}

async function findByGoogleId(googleId) {
  if (pool) {
    const { rows } = await pool.query("SELECT * FROM users WHERE google_id = $1", [googleId]);
    return rowToUser(rows[0]);
  }
  const list = readUsersFile();
  return list.find((u) => u.googleId === googleId) || null;
}

async function addUser({ name, email, passwordHash, googleId, demographics }) {
  const id = crypto.randomUUID();
  const demo = demographics || {};

  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO users (id, name, email, password_hash, google_id, age_range, gender, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, name, email, passwordHash || null, googleId || null, demo.ageRange || "", demo.gender || "", demo.country || ""]
    );
    return rowToUser(rows[0]);
  }

  const list = readUsersFile();
  const user = { id, name, email, passwordHash: passwordHash || null, googleId: googleId || null, demographics: demo, createdAt: new Date().toISOString() };
  list.push(user);
  writeUsersFile(list);
  return user;
}

async function setPasswordHash(userId, passwordHash) {
  if (pool) {
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
    return;
  }
  const list = readUsersFile();
  const user = list.find((u) => u.id === userId);
  if (user) { user.passwordHash = passwordHash; writeUsersFile(list); }
}

function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash, ...publicFields } = user;
  return publicFields;
}

module.exports = { findByEmail, findById, findByGoogleId, addUser, setPasswordHash, toPublicUser };
