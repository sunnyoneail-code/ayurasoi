// One-off patch: adds the 5 category-label keys to every language already
// present in uiText.json (they were added to the master file after the
// initial generation run had already moved past the UI-text phase).

const fs = require("fs");
const path = require("path");
const { LANGUAGES } = require("../languages");
const { translateLines } = require("../recipeExtractor");

const UI_EN_PATH = path.join(__dirname, "..", "data", "uiText.en.json");
const UI_OUT_PATH = path.join(__dirname, "..", "data", "uiText.json");

const CAT_KEYS = ["catAll", "catDigestion", "catImmunity", "catColdCough", "catVitality"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const en = JSON.parse(fs.readFileSync(UI_EN_PATH, "utf-8"));
  const out = JSON.parse(fs.readFileSync(UI_OUT_PATH, "utf-8"));
  out.en = en;

  for (const lang of LANGUAGES) {
    if (lang.code === "en") continue;
    if (!out[lang.code]) continue;
    if (CAT_KEYS.every((k) => out[lang.code][k])) continue;

    if (lang.code === "yue") {
      if (out.zh) CAT_KEYS.forEach((k) => { out.yue[k] = out.zh[k]; });
      console.log(`  [cat] yue <- copied from zh`);
      continue;
    }

    try {
      const values = CAT_KEYS.map((k) => en[k]);
      const translated = await translateLines(values, lang.translateCode);
      CAT_KEYS.forEach((k, i) => { out[lang.code][k] = translated[i]; });
      console.log(`  [cat] ${lang.code} OK`);
    } catch (err) {
      console.log(`  [cat] ${lang.code} FAILED: ${err.message}`);
    }
    fs.writeFileSync(UI_OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
    await sleep(150);
  }

  fs.writeFileSync(UI_OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
  console.log("Category labels patched.");
})();
