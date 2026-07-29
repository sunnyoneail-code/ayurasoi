// One-time (re-runnable) migration: translates server/data/sourceTexts.json's
// name/imageAlt/description into every language in server/languages.js.
// Safe to re-run — skips any text/language pair already translated.
// Mirrors generateTranslations.js's approach for recipes.

const fs = require("fs");
const path = require("path");
const { LANGUAGES: ALL_LANGUAGES } = require("../languages");
const { translateBlock } = require("../recipeExtractor");

const ONLY_CODES = process.argv.slice(2);
const LANGUAGES = ONLY_CODES.length
  ? ALL_LANGUAGES.filter((l) => ONLY_CODES.includes(l.code))
  : ALL_LANGUAGES;

const SOURCE_TEXTS_PATH = path.join(__dirname, "..", "data", "sourceTexts.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function migrate() {
  const texts = JSON.parse(fs.readFileSync(SOURCE_TEXTS_PATH, "utf-8"));

  for (const entry of texts) {
    for (const lang of LANGUAGES) {
      if (lang.code === "en") continue;

      if (lang.code === "yue") {
        if (entry.zh && !entry.yue) {
          entry.yue = { ...entry.zh };
          console.log(`  [${entry.id}] yue <- copied from zh`);
        }
        continue;
      }

      if (entry[lang.code]) continue;

      try {
        const target = lang.translateCode;
        const name = await translateBlock(entry.en.name, target);
        const imageAlt = await translateBlock(entry.en.imageAlt, target);
        const description = await translateBlock(entry.en.description, target);
        entry[lang.code] = { name, imageAlt, description };
        console.log(`  [${entry.id}] ${lang.code} OK`);
      } catch (err) {
        console.log(`  [${entry.id}] ${lang.code} FAILED: ${err.message}`);
      }
      fs.writeFileSync(SOURCE_TEXTS_PATH, JSON.stringify(texts, null, 2), "utf-8");
      await sleep(500);
    }
  }

  fs.writeFileSync(SOURCE_TEXTS_PATH, JSON.stringify(texts, null, 2), "utf-8");
  console.log("Source texts done.");
}

migrate();
