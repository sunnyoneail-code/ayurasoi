const { pool } = require("./db");

async function listFavorites(userId) {
  if (!pool) return [];
  const { rows } = await pool.query("SELECT recipe_id FROM favorites WHERE user_id = $1", [userId]);
  return rows.map((r) => r.recipe_id);
}

async function toggleFavorite(userId, recipeId) {
  if (!pool) {
    const err = new Error("Favorites require a database connection (DATABASE_URL not set).");
    err.code = "NO_DB";
    throw err;
  }
  const existing = await pool.query("SELECT 1 FROM favorites WHERE user_id = $1 AND recipe_id = $2", [userId, recipeId]);
  if (existing.rows.length) {
    await pool.query("DELETE FROM favorites WHERE user_id = $1 AND recipe_id = $2", [userId, recipeId]);
    return { favorited: false };
  }
  await pool.query("INSERT INTO favorites (user_id, recipe_id) VALUES ($1, $2)", [userId, recipeId]);
  return { favorited: true };
}

module.exports = { listFavorites, toggleFavorite };
