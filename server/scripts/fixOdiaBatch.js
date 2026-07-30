// One-off: re-translate the "purpose" and "safety" fields for the new
// memory-focus/respiratory batch into Odia, sentence-by-sentence
// (splitting a paragraph into individual sentences reliably avoids a
// reproducible Google Translate Odia bug where certain English words —
// "medication", "breathing", "clarity", "daily", "simmer", "raise",
// "supervised", "reached", "pour", "practitioner", "optional" — leak
// through untranslated mid-word when embedded in a longer sentence).
const fs = require("fs");
const path = require("path");
const { translateBlock } = require("../recipeExtractor");

const RECIPES_PATH = path.join(__dirname, "..", "data", "recipes.json");
const TARGET_IDS = [
  "brahmi-bacopa-memory-milk", "shankhpushpi-focus-milk", "vacha-honey-mental-clarity",
  "jyotishmati-oil-memory-massage", "vardhamana-pippali-respiratory-rasayana",
  "kantakari-breathing-comfort-decoction", "talisadi-churna-respiratory-tonic",
  "vasaka-pippali-honey-lehya", "vasaka-respiratory-decoction", "vasaka-steam-inhalation-chest-opening"
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function splitSentences(text) {
  // Split on ". " / "! " / "? " while keeping the punctuation, plus a
  // trailing sentence with no following space.
  return text.match(/[^.!?]+[.!?]+(\s+|$)/g)?.map((s) => s.trim()).filter(Boolean) || [text];
}

async function translateParagraph(text, targetLang) {
  const sentences = splitSentences(text);
  const translated = [];
  for (const s of sentences) {
    translated.push(await translateBlock(s, targetLang));
    await sleep(120);
  }
  return translated.join(" ");
}

(async () => {
  const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, "utf-8"));

  for (const id of TARGET_IDS) {
    const r = recipes.find((x) => x.id === id);
    if (!r) { console.log(`[skip] ${id} not found`); continue; }

    const newPurpose = await translateParagraph(r.en.purpose, "or");
    r.or.purpose = newPurpose;
    console.log(`[${id}] purpose OK`);

    const newSafety = await translateParagraph(r.en.safety, "or");
    r.or.safety = newSafety;
    console.log(`[${id}] safety OK`);

    fs.writeFileSync(RECIPES_PATH, JSON.stringify(recipes, null, 2), "utf-8");
  }

  console.log("Done.");
})();
