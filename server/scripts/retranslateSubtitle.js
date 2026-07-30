// One-off: re-translate just the "subtitle" key in uiText.json after the
// tagline copy changed, without touching any other already-translated key.
const fs = require("fs");
const path = require("path");
const { LANGUAGES } = require("../languages");
const { translateBlock } = require("../recipeExtractor");

const UI_EN_PATH = path.join(__dirname, "..", "data", "uiText.en.json");
const UI_OUT_PATH = path.join(__dirname, "..", "data", "uiText.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const en = JSON.parse(fs.readFileSync(UI_EN_PATH, "utf-8"));
  const out = JSON.parse(fs.readFileSync(UI_OUT_PATH, "utf-8"));
  out.en.subtitle = en.subtitle;

  for (const lang of LANGUAGES) {
    if (lang.code === "en") continue;
    if (!out[lang.code]) continue;

    if (lang.code === "yue") {
      out.yue.subtitle = out.zh ? out.zh.subtitle : en.subtitle;
      console.log(`[ui] yue <- copied from zh`);
      continue;
    }

    try {
      const translated = await translateBlock(en.subtitle, lang.translateCode);
      out[lang.code].subtitle = translated;
      console.log(`[ui] ${lang.code} OK: ${translated}`);
    } catch (err) {
      console.log(`[ui] ${lang.code} FAILED: ${err.message}`);
    }
    fs.writeFileSync(UI_OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
    await sleep(150);
  }

  fs.writeFileSync(UI_OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
  console.log("Subtitle re-translation done.");
})();
