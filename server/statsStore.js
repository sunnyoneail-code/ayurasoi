const { pool } = require("./db");
const store = require("./recipeStore");

function requireDb() {
  if (pool) return;
  const err = new Error("The dashboard requires a database connection (DATABASE_URL not set).");
  err.code = "NO_DB";
  throw err;
}

async function getUserStats() {
  const totalRes = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  const recentRes = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last7,
       COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS last30
     FROM users`
  );
  const methodRes = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE google_id IS NOT NULL)::int AS google,
       COUNT(*) FILTER (WHERE facebook_id IS NOT NULL)::int AS facebook,
       COUNT(*) FILTER (WHERE google_id IS NULL AND facebook_id IS NULL)::int AS password
     FROM users`
  );
  const ageRes = await pool.query(
    `SELECT COALESCE(NULLIF(age_range, ''), 'Not given') AS label, COUNT(*)::int AS count
     FROM users GROUP BY label ORDER BY count DESC`
  );
  const genderRes = await pool.query(
    `SELECT COALESCE(NULLIF(gender, ''), 'Not given') AS label, COUNT(*)::int AS count
     FROM users GROUP BY label ORDER BY count DESC`
  );
  const countryRes = await pool.query(
    `SELECT COALESCE(NULLIF(country, ''), 'Not given') AS label, COUNT(*)::int AS count
     FROM users GROUP BY label ORDER BY count DESC LIMIT 15`
  );

  return {
    total: totalRes.rows[0].count,
    newLast7Days: recentRes.rows[0].last7,
    newLast30Days: recentRes.rows[0].last30,
    signupMethod: { google: methodRes.rows[0].google, facebook: methodRes.rows[0].facebook, password: methodRes.rows[0].password },
    ageRangeBreakdown: ageRes.rows,
    genderBreakdown: genderRes.rows,
    countryBreakdown: countryRes.rows
  };
}

async function getEngagementStats() {
  const recipes = store.readRecipes();
  const recipeById = {};
  recipes.forEach((r) => { recipeById[r.id] = { title: r.en.name, category: r.category }; });

  const favTotalRes = await pool.query("SELECT COUNT(*)::int AS count FROM favorites");
  const favByRecipeRes = await pool.query(
    "SELECT recipe_id, COUNT(*)::int AS count FROM favorites GROUP BY recipe_id ORDER BY count DESC LIMIT 10"
  );
  const ratingTotalRes = await pool.query(
    "SELECT COUNT(*)::int AS count, COALESCE(AVG(rating), 0)::float AS average FROM ratings"
  );
  const topRatedRes = await pool.query(
    `SELECT recipe_id, COUNT(*)::int AS count, AVG(rating)::float AS average
     FROM ratings GROUP BY recipe_id ORDER BY average DESC, count DESC LIMIT 10`
  );

  // Category popularity by favorites — recipes live in the JSON file, not
  // the database, so this join happens here in JS rather than in SQL.
  const favAllRes = await pool.query("SELECT recipe_id FROM favorites");
  const categoryCounts = {};
  favAllRes.rows.forEach((r) => {
    const cat = recipeById[r.recipe_id]?.category || "unknown";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  const categoryPopularity = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const withTitles = (rows) => rows.map((r) => ({
    recipeId: r.recipe_id,
    title: recipeById[r.recipe_id]?.title || r.recipe_id,
    category: recipeById[r.recipe_id]?.category || "unknown",
    count: r.count,
    average: r.average
  }));

  return {
    totalFavorites: favTotalRes.rows[0].count,
    topFavorited: withTitles(favByRecipeRes.rows),
    totalRatings: ratingTotalRes.rows[0].count,
    averageRatingOverall: ratingTotalRes.rows[0].average,
    topRated: withTitles(topRatedRes.rows),
    categoryPopularity
  };
}

async function getDashboard() {
  requireDb();
  const [users, engagement] = await Promise.all([getUserStats(), getEngagementStats()]);
  return { users, engagement, recipeCount: store.readRecipes().length };
}

module.exports = { getDashboard };
