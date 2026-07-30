// One-off: translate a small set of newly-added uiText.en.json keys into
// every language already present in uiText.json, without touching any
// other existing key/value. Re-runnable — skips a key for a language if
// that language already has a non-empty value for it.
const fs = require("fs");
const path = require("path");
const { LANGUAGES } = require("../languages");
const { translateBlock } = require("../recipeExtractor");

const NEW_KEYS = ["catMemoryFocus", "catRespiratory"];

const UI_EN_PATH = path.join(__dirname, "..", "data", "uiText.en.json");
const UI_OUT_PATH = path.join(__dirname, "..", "data", "uiText.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const en = JSON.parse(fs.readFileSync(UI_EN_PATH, "utf-8"));
  const out = JSON.parse(fs.readFileSync(UI_OUT_PATH, "utf-8"));

  NEW_KEYS.forEach((k) => { out.en[k] = en[k]; });

  for (const lang of LANGUAGES) {
    if (lang.code === "en") continue;
    if (!out[lang.code]) continue;

    if (lang.code === "yue") {
      NEW_KEYS.forEach((k) => { out.yue[k] = out.zh ? out.zh[k] : en[k]; });
      console.log(`[ui] yue <- copied from zh`);
      continue;
    }

    for (const k of NEW_KEYS) {
      if (out[lang.code][k]) continue;
      try {
        const translated = await translateBlock(en[k], lang.translateCode);
        out[lang.code][k] = translated;
        console.log(`[ui] ${lang.code}.${k} OK: ${translated}`);
      } catch (err) {
        console.log(`[ui] ${lang.code}.${k} FAILED: ${err.message}`);
      }
      fs.writeFileSync(UI_OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
      await sleep(150);
    }
  }

  fs.writeFileSync(UI_OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
  console.log("New key translation done.");
})();
