// Fully free replacement for the old Claude-based extractor. No API key,
// no signup, no cost. Trades "understands any messy text" for "understands
// clearly labeled sections" — see README for the expected input format.

const { LANGUAGES } = require("./languages");

const ALLOWED_CATEGORIES = ["digestion", "immunity", "cold-cough", "vitality"];

const HEADERS = {
  ingredients: /^(ingredients?)\s*:?\s*(.*)$/i,
  steps: /^(steps|instructions|method|procedure|directions)\s*:?\s*(.*)$/i,
  source: /^(source|reference|citation|from)\s*:\s*(.+)$/i,
  safety: /^(safety|caution|warning|note)s?\s*:?\s*(.*)$/i,
  name: /^(name|title)\s*:\s*(.+)$/i
};

const COMMON_INGREDIENTS = [
  "milk", "water", "honey", "ginger", "black pepper", "pepper", "cardamom",
  "jaggery", "tulsi", "basil", "cinnamon", "clove", "cumin", "coriander",
  "fennel", "turmeric", "salt", "lemon", "garlic", "sugar", "rice", "ghee"
];

const CATEGORY_KEYWORDS = {
  digestion: /digest|stomach|bloat|gas\b|acid|constipat/i,
  "cold-cough": /cough|throat|congestion|cold\b/i,
  immunity: /immun|inflam|fever/i,
  vitality: /energy|stress|sleep|vitality|tonic|strength|rejuven/i
};

function stripBullet(line) {
  return line.replace(/^\s*([-*•]|\d+[.)])\s*/, "").trim();
}

function detectCategory(text) {
  for (const [cat, re] of Object.entries(CATEGORY_KEYWORDS)) {
    if (re.test(text)) return cat;
  }
  return "vitality";
}

function detectUncommonIngredient(ingredients) {
  for (const ing of ingredients) {
    const lower = ing.toLowerCase();
    const isCommon = COMMON_INGREDIENTS.some((c) => lower.includes(c));
    if (!isCommon) {
      const cleaned = ing.replace(/[—-].*$/, "").trim();
      return { name: { en: cleaned }, links: [] };
    }
  }
  return null;
}

function parseRecipeText(rawText) {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) {
    const err = new Error("That text looks empty.");
    err.code = "NOT_A_RECIPE";
    throw err;
  }

  let name = null;
  let purpose = [];
  let ingredients = [];
  let steps = [];
  let source = "";
  let safety = "";
  let section = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const nameMatch = line.match(HEADERS.name);
    if (nameMatch) { name = nameMatch[2].trim(); section = null; continue; }

    const ingMatch = line.match(HEADERS.ingredients);
    if (ingMatch) {
      section = "ingredients";
      if (ingMatch[2]) ingredients.push(...ingMatch[2].split(",").map((s) => s.trim()).filter(Boolean));
      continue;
    }

    const stepMatch = line.match(HEADERS.steps);
    if (stepMatch) {
      section = "steps";
      if (stepMatch[2]) steps.push(...stepMatch[2].split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean));
      continue;
    }

    const sourceMatch = line.match(HEADERS.source);
    if (sourceMatch) { source = sourceMatch[2].trim(); section = null; continue; }

    const safetyMatch = line.match(HEADERS.safety);
    if (safetyMatch) {
      section = "safety";
      if (safetyMatch[2]) safety = safetyMatch[2].trim();
      continue;
    }

    if (section === "ingredients") { ingredients.push(stripBullet(line)); continue; }
    if (section === "steps") { steps.push(stripBullet(line)); continue; }
    if (section === "safety") { safety = safety ? safety + " " + line : line; continue; }

    if (name === null && i === 0) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0 && colonIdx < 60) {
        name = line.slice(0, colonIdx).trim();
        purpose.push(line.slice(colonIdx + 1).trim());
        continue;
      }
      name = line.length > 60 ? line.slice(0, 60) : line;
      continue;
    }

    purpose.push(line);
  }

  const fullText = rawText;

  if (ingredients.length === 0) {
    const commaLine = lines.find((l) => (l.match(/,/g) || []).length >= 2);
    if (commaLine) ingredients = commaLine.split(",").map((s) => s.trim()).filter(Boolean);
  }

  if (steps.length === 0) {
    const prose = purpose.join(" ");
    const sentences = prose.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
    if (sentences.length > 1) steps = sentences;
  }

  if (!name || (ingredients.length === 0 && steps.length === 0)) {
    const err = new Error(
      "Couldn't find clear ingredients or steps. Try labeling sections, e.g.:\n" +
      "Name: Ginger tea\nIngredients:\n- Ginger\n- Water\nSteps:\n1. Boil ginger in water.\n2. Strain and drink."
    );
    err.code = "NOT_A_RECIPE";
    throw err;
  }

  return {
    category: detectCategory(fullText),
    source: source || "No classical source given — needs verification before use.",
    uncommonIngredient: detectUncommonIngredient(ingredients),
    en: {
      name,
      purpose: purpose.join(" ").slice(0, 300) || name,
      ingredients,
      steps,
      safety: safety || "No safety information provided — must be reviewed by a qualified Ayurvedic practitioner before use."
    }
  };
}

// Translation provider chain, all free and keyless:
// 1. Google's public "gtx" client endpoint — the same backend Lingva
//    itself wraps, but hit directly instead of through a community-run
//    proxy (this mirrors how audio narration already talks to Google's
//    public translate_tts endpoint directly).
// 2. Lingva Translate mirrors, as a fallback if Google's endpoint is
//    ever unreachable.
// 3. MyMemory — a dedicated free translation API, last resort (has a
//    short per-request text length limit, fine as a final fallback).
const LINGVA_INSTANCES = process.env.LINGVA_URL
  ? [process.env.LINGVA_URL]
  : ["https://lingva.ml", "https://translate.plausibility.cloud"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateViaGoogle(text, target) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google translate returned ${res.status}`);
  const data = await res.json();
  const segments = data && data[0];
  if (!Array.isArray(segments) || !segments.length) throw new Error("Google translate returned no text.");
  return segments.map((seg) => seg[0]).join("");
}

async function translateViaLingva(text, target) {
  let lastError;
  for (const base of LINGVA_INSTANCES) {
    try {
      const res = await fetch(`${base}/api/v1/en/${target}/${encodeURIComponent(text)}`);
      if (!res.ok) throw new Error(`Lingva returned ${res.status}`);
      const data = await res.json();
      if (!data.translation) throw new Error("Lingva returned no text.");
      return data.translation;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function translateViaMyMemory(text, target) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(target)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory returned ${res.status}`);
  const data = await res.json();
  const translated = data && data.responseData && data.responseData.translatedText;
  if (!translated) throw new Error("MyMemory returned no text.");
  return translated;
}

const PROVIDERS = [translateViaGoogle, translateViaLingva, translateViaMyMemory];

// A couple of short retries with backoff rides out a transient blip
// across the whole provider chain without waiting for a separate script
// run; a sustained outage still surfaces as a normal failure so the
// resumable migration script can pick it up again later.
async function translateBlock(text, target, retriesLeft = 2) {
  let lastError;
  for (const provider of PROVIDERS) {
    try {
      return await provider(text, target);
    } catch (err) {
      lastError = err;
    }
  }
  if (retriesLeft > 0) {
    await sleep(5000 * (3 - retriesLeft));
    return translateBlock(text, target, retriesLeft - 1);
  }
  throw lastError;
}

async function translateLines(lines, target) {
  const joined = lines.join("\n");
  const translated = await translateBlock(joined, target);
  const parts = translated.split("\n");
  if (parts.length === lines.length) return parts;
  const out = [];
  for (const line of lines) out.push(await translateBlock(line, target));
  return out;
}

// Translates a recipe's English fields into every configured language.
// Cantonese (yue) has no distinct Lingva/Google Translate target, so it
// reuses whatever "zh" produced instead of making its own request.
async function translateAllLanguages(recipe) {
  const failed = [];

  for (const lang of LANGUAGES) {
    if (lang.code === "en") continue;

    if (lang.code === "yue") {
      if (recipe.zh) {
        recipe.yue = { ...recipe.zh };
        if (recipe.uncommonIngredient && recipe.uncommonIngredient.name.zh) {
          recipe.uncommonIngredient.name.yue = recipe.uncommonIngredient.name.zh;
        }
      } else {
        failed.push("yue");
      }
      continue;
    }

    try {
      const target = lang.translateCode;
      const [name, purpose] = await translateLines([recipe.en.name, recipe.en.purpose], target);
      const ingredients = await translateLines(recipe.en.ingredients, target);
      const steps = await translateLines(recipe.en.steps, target);
      const safety = await translateBlock(recipe.en.safety, target);
      recipe[lang.code] = { name, purpose, ingredients, steps, safety };
      if (recipe.uncommonIngredient) {
        recipe.uncommonIngredient.name[lang.code] = await translateBlock(recipe.uncommonIngredient.name.en, target);
      }
    } catch (err) {
      recipe[lang.code] = { ...recipe.en };
      if (recipe.uncommonIngredient) recipe.uncommonIngredient.name[lang.code] = recipe.uncommonIngredient.name.en;
      failed.push(lang.code);
    }
  }

  if (failed.length) {
    recipe.translationWarning =
      `The free translation service didn't respond for: ${failed.join(", ")}. Those languages currently show English text as a fallback — try regenerating later.`;
  }

  return recipe;
}

async function generateRecipeFromText(freeformText) {
  const parsed = parseRecipeText(freeformText);
  if (!ALLOWED_CATEGORIES.includes(parsed.category)) parsed.category = "vitality";
  return translateAllLanguages(parsed);
}

module.exports = { generateRecipeFromText, translateAllLanguages, translateBlock, translateLines, ALLOWED_CATEGORIES };
