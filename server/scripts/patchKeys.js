// One-off patch: force re-translates a specific list of UI text keys
// across every already-generated language (used when a key's English
// text changes, or a new key is added, after the initial bulk run).
// Usage: node scripts/patchKeys.js key1 key2 key3

const fs = require("fs");
const path = require("path");
const { LANGUAGES } = require("../languages");
const { translateLines } = require("../recipeExtractor");

const UI_EN_PATH = path.join(__dirname, "..", "data", "uiText.en.json");
const UI_OUT_PATH = path.join(__dirname, "..", "data", "uiText.json");

const KEYS = process.argv.slice(2);
if (KEYS.length === 0) {
  console.log("Usage: node scripts/patchKeys.js key1 key2 ...");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const en = JSON.parse(fs.readFileSync(UI_EN_PATH, "utf-8"));
  const out = JSON.parse(fs.readFileSync(UI_OUT_PATH, "utf-8"));
  out.en = en;

  for (const lang of LANGUAGES) {
    if (lang.code === "en") continue;
    if (!out[lang.code]) continue;

    if (lang.code === "yue") {
      if (out.zh) KEYS.forEach((k) => { out.yue[k] = out.zh[k]; });
      console.log(`  [patch] yue <- copied from zh`);
      continue;
    }

    try {
      const values = KEYS.map((k) => en[k]);
      const translated = await translateLines(values, lang.translateCode);
      KEYS.forEach((k, i) => { out[lang.code][k] = translated[i]; });
      console.log(`  [patch] ${lang.code} OK`);
    } catch (err) {
      console.log(`  [patch] ${lang.code} FAILED: ${err.message}`);
    }
    fs.writeFileSync(UI_OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
    await sleep(150);
  }

  fs.writeFileSync(UI_OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
  console.log("Done.");
})();
