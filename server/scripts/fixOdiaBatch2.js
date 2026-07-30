// Second pass: targeted regex fixes for a reproducible Google Translate
// Odia bug where specific English words leak through untranslated
// mid-word (medication, herb, breathing, clarity, daily, raise,
// supervised, reached, pour, any, optional) regardless of sentence
// complexity — rewording alone wasn't enough; each pattern's correct
// Odia reconstruction is applied directly here, verified against
// clean translations of the same words in unaffected contexts.
const fs = require("fs");
const path = require("path");

const RECIPES_PATH = path.join(__dirname, "..", "data", "recipes.json");
const TARGET_IDS = [
  "brahmi-bacopa-memory-milk", "shankhpushpi-focus-milk", "vacha-honey-mental-clarity",
  "jyotishmati-oil-memory-massage", "vardhamana-pippali-respiratory-rasayana",
  "kantakari-breathing-comfort-decoction", "talisadi-churna-respiratory-tonic",
  "vasaka-pippali-honey-lehya", "vasaka-respiratory-decoction", "vasaka-steam-inhalation-chest-opening"
];

const REPLACEMENTS = [
  [/[a-zA-Z]{1,12}\s+ଷଧ/g, "ଔଷଧ"],
  [/ବ\s*al\s*କଳ୍ପିକ/g, "ବୈକଳ୍ପିକ"],
  [/ସ୍\s*ity\s*ଚ୍ଛତା/g, "ସ୍ୱଚ୍ଛତା"],
  [/ବିଶେଷତ\s*higher\s*ଅଧିକ/g, "ବିଶେଷତଃ ଅଧିକ"],
  [/ଦ\s*daily\s*ନିକ/g, "ଦୈନିକ"],
  [/ବ\s*(?:av|\.|raise|increase)\s*ାଇ/g, "ବଢାଇ"],
  [/ଅଭ୍ୟାସକାରୀଙ୍କ\s+ଦ୍\s*ised\s*ାରା/g, "ଅଭ୍ୟାସକାରୀଙ୍କ ଦ୍ୱାରା"],
  [/କ\s*pract\s*ଣସି/g, "କୌଣସି"],
  [/ପହ\s*reached\s*୍ଚିଗଲା/g, "ପହଞ୍ଚିଗଲା"],
  [/pour\s*ାଳନ୍ତୁ/g, "ଢାଳନ୍ତୁ"],
  [/ଶ୍\s*(?:hing|ir)\s*ାସକ୍ରିୟା/g, "ଶ୍ୱାସକ୍ରିୟା"],
  [/ନି\s*hing\s*ଶ୍ୱାସ/g, "ନିଶ୍ୱାସ"],
  [/ସି\s*mer\s*ାନ୍ତୁ/g, "ରାନ୍ଧନ୍ତୁ"]
];

function fixText(t) {
  if (typeof t !== "string") return t;
  let out = t;
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement);
  return out;
}

const recipes = JSON.parse(fs.readFileSync(RECIPES_PATH, "utf-8"));

for (const id of TARGET_IDS) {
  const r = recipes.find((x) => x.id === id);
  if (!r) continue;
  r.or.name = fixText(r.or.name);
  r.or.purpose = fixText(r.or.purpose);
  r.or.safety = fixText(r.or.safety);
  r.or.ingredients = r.or.ingredients.map(fixText);
  r.or.steps = r.or.steps.map(fixText);
}

// Direct full-field replacements for cases regex reconstruction can't
// safely cover (number-range formatting broke differently per recipe).
const jyotishmati = recipes.find((x) => x.id === "jyotishmati-oil-memory-massage");
jyotishmati.or.safety = jyotishmati.or.safety.replace(
  /ଯଦି ତ୍ୱଚା ଜ୍\s*\.ର\s*ହୁଏ ତେବେ ବନ୍ଦ କରନ୍ତୁ ।?/,
  "ଯଦି ତ୍ୱଚା ବିରକ୍ତ ହୁଏ ତେବେ ବ୍ୟବହାର ବନ୍ଦ କରନ୍ତୁ |"
);

const shankhpushpi = recipes.find((x) => x.id === "shankhpushpi-focus-milk");
shankhpushpi.or.steps[2] = "କମ୍ ଉତ୍ତାପରେ ଦୁଇରୁ ତିନି ମିନିଟ୍ ପର୍ଯ୍ୟନ୍ତ ରାନ୍ଧନ୍ତୁ, ମିଶ୍ରଣ କରନ୍ତୁ ତେଣୁ ପ୍ୟାନରେ କିଛି ନଥାଏ |";

const vasakaSteam = recipes.find((x) => x.id === "vasaka-steam-inhalation-chest-opening");
vasakaSteam.or.steps[1] = "ଏହାକୁ ଦୁଇରୁ ତିନି ମିନିଟ୍ ପର୍ଯ୍ୟନ୍ତ ରାନ୍ଧନ୍ତୁ, ତାପରେ ଗରମ ପାଣି ଏବଂ ପତ୍ରକୁ ଏକ ବଡ଼ ପାତ୍ରରେ ସ୍ଥାନାନ୍ତର କରନ୍ତୁ |";

fs.writeFileSync(RECIPES_PATH, JSON.stringify(recipes, null, 2), "utf-8");
console.log("Done.");
