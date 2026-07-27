const crypto = require("crypto");
const { pool } = require("./db");

function requireDb() {
  if (pool) return;
  const err = new Error("Ratings require a database connection (DATABASE_URL not set).");
  err.code = "NO_DB";
  throw err;
}

async function upsertRating(userId, recipeId, rating, comment) {
  requireDb();
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO ratings (id, user_id, recipe_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, recipe_id)
     DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = now()`,
    [id, userId, recipeId, rating, comment || ""]
  );
}

async function getRatingsForRecipe(recipeId) {
  if (!pool) return { average: null, count: 0, comments: [] };
  const { rows } = await pool.query(
    `SELECT r.rating, r.comment, r.created_at, u.name AS user_name
     FROM ratings r JOIN users u ON u.id = r.user_id
     WHERE r.recipe_id = $1
     ORDER BY r.created_at DESC`,
    [recipeId]
  );
  const count = rows.length;
  const average = count ? rows.reduce((sum, r) => sum + r.rating, 0) / count : null;
  return {
    average,
    count,
    comments: rows.map((r) => ({
      userName: r.user_name,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at
    }))
  };
}

async function getAllAverages() {
  if (!pool) return {};
  const { rows } = await pool.query(
    `SELECT recipe_id, AVG(rating)::float AS average, COUNT(*)::int AS count FROM ratings GROUP BY recipe_id`
  );
  const map = {};
  rows.forEach((r) => { map[r.recipe_id] = { average: r.average, count: r.count }; });
  return map;
}

async function getUserRating(userId, recipeId) {
  if (!pool) return null;
  const { rows } = await pool.query(
    "SELECT rating, comment FROM ratings WHERE user_id = $1 AND recipe_id = $2",
    [userId, recipeId]
  );
  return rows[0] || null;
}

module.exports = { upsertRating, getRatingsForRecipe, getAllAverages, getUserRating };
