const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "data", "recipes.json");

function readRecipes() {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeRecipes(recipes) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(recipes, null, 2), "utf-8");
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function addRecipe(recipe) {
  const recipes = readRecipes();
  let id = slugify(recipe.en.name) || "recipe";
  let suffix = 1;
  const existingIds = new Set(recipes.map((r) => r.id));
  let candidate = id;
  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${id}-${suffix}`;
  }
  const full = { ...recipe, id: candidate, videoUrl: null };
  recipes.push(full);
  writeRecipes(recipes);
  return full;
}

function updateRecipe(id, updates) {
  const recipes = readRecipes();
  const idx = recipes.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  recipes[idx] = { ...recipes[idx], ...updates };
  writeRecipes(recipes);
  return recipes[idx];
}

function getRecipe(id) {
  return readRecipes().find((r) => r.id === id) || null;
}

module.exports = { readRecipes, writeRecipes, addRecipe, updateRecipe, getRecipe };
