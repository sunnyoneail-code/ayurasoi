// One-time (re-runnable) migration: translates every existing recipe and
// the UI text dictionary into every language in server/languages.js using
// the free Lingva Translate service. Safe to re-run — it skips any
// recipe/language pair that's already translated, so an interrupted run
// just picks up where it left off.

const fs = require("fs");
const path = require("path");
const { LANGUAGES } = require("../languages");
const { translateBlock, translateLines } = require("../recipeExtractor");

const RECIPES_PATH = path.join(__dirname, "..", "data", "recipes.json");
const UI_EN_PATH = path.join(__dirname, "..", "data", "uiText.en.json");
const UI_OUT_PATH = path.join(__dirname, "..", "data", "uiText.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function migrateUncommonIngredientShape(recipe) {
  const u = recipe.uncommonIngredient;
  if (u && (u.name_en || u.name_hi) && !u.name) {
    recipe.uncommonIngredient = {
      name: { en: u.name_en, ...(u.name_hi ? { hi: u.name_hi } : {}) },
      links: u.links || []
    };
  }
}

async function translateRecipeToLang(recipe, lang) {
  const target = lang.translateCode;
  const [name, purpose] = await translateLines([recipe.en.name, recipe.en.purpose], target);
  const ingredients = await translateLines(recipe.en.ingredients, target);
  const steps = await translateLines(recipe.en.steps, target);
  const safety = await translateBlock(recipe.en.safety, target);
  recipe[lang.code] = { name, purpose, ingredients, steps, safety };
  if (recipe.uncommonIngredient) {
    recipe.uncommonIngredient.name[lang.code] = await translateBlock(recipe.uncommonIngredient.name.en, target);
  }
}

async function migrateRecipes() {
  const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, "utf-8"));

  for (const recipe of recipes) {
    migrateUncommonIngredientShape(recipe);

    for (const lang of LANGUAGES) {
      if (lang.code === "en") continue;

      if (lang.code === "yue") {
        if (recipe.zh && !recipe.yue) {
          recipe.yue = { ...recipe.zh };
          if (recipe.uncommonIngredient && recipe.uncommonIngredient.name.zh) {
            recipe.uncommonIngredient.name.yue = recipe.uncommonIngredient.name.zh;
          }
          console.log(`  [${recipe.id}] yue <- copied from zh`);
        }
        continue;
      }

      if (recipe[lang.code]) continue;

      try {
        await translateRecipeToLang(recipe, lang);
        console.log(`  [${recipe.id}] ${lang.code} OK`);
      } catch (err) {
        console.log(`  [${recipe.id}] ${lang.code} FAILED: ${err.message}`);
      }
      fs.writeFileSync(RECIPES_PATH, JSON.stringify(recipes, null, 2), "utf-8");
      await sleep(150);
    }
  }

  fs.writeFileSync(RECIPES_PATH, JSON.stringify(recipes, null, 2), "utf-8");
  console.log("Recipes done.");
}

async function migrateUiText() {
  const en = JSON.parse(fs.readFileSync(UI_EN_PATH, "utf-8"));
  let out = {};
  if (fs.existsSync(UI_OUT_PATH)) out = JSON.parse(fs.readFileSync(UI_OUT_PATH, "utf-8"));
  out.en = en;

  const keys = Object.keys(en);

  for (const lang of LANGUAGES) {
    if (lang.code === "en") continue;

    if (lang.code === "yue") {
      if (out.zh && !out.yue) {
        out.yue = { ...out.zh };
        console.log(`  [ui] yue <- copied from zh`);
      }
      continue;
    }

    if (out[lang.code]) continue;

    try {
      const values = keys.map((k) => en[k]);
      const translated = await translateLines(values, lang.translateCode);
      const langOut = {};
      keys.forEach((k, i) => { langOut[k] = translated[i]; });
      out[lang.code] = langOut;
      console.log(`  [ui] ${lang.code} OK`);
    } catch (err) {
      console.log(`  [ui] ${lang.code} FAILED: ${err.message}`);
    }
    fs.writeFileSync(UI_OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
    await sleep(150);
  }

  fs.writeFileSync(UI_OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
  console.log("UI text done.");
}

(async () => {
  console.log("Translating UI text...");
  await migrateUiText();
  console.log("Translating recipes...");
  await migrateRecipes();
  console.log("All done.");
})();
