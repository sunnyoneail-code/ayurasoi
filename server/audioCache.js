const fs = require("fs");
const path = require("path");
const { LANGUAGES } = require("./languages");
const { synthesizeSpeech } = require("./tts");

const AUDIO_DIR = path.join(__dirname, "audio");

function manifestPath(recipeId, lang) {
  return path.join(AUDIO_DIR, recipeId, lang, "manifest.json");
}

async function getOrCreateAudioManifest(recipe, langCode) {
  const lang = LANGUAGES.find((l) => l.code === langCode);
  if (!lang) throw new Error("Unknown language.");
  if (!lang.ttsCode) {
    const err = new Error(`Voice narration isn't available for ${lang.label} — the free text-to-speech service has no voice for this language.`);
    err.code = "TTS_UNSUPPORTED";
    throw err;
  }

  const dir = path.join(AUDIO_DIR, recipe.id, langCode);
  const mPath = manifestPath(recipe.id, langCode);
  if (fs.existsSync(mPath)) {
    return JSON.parse(fs.readFileSync(mPath, "utf-8"));
  }

  const data = recipe[langCode] || recipe.en;
  const lines = [data.purpose, ...data.steps];

  fs.mkdirSync(dir, { recursive: true });
  const urls = [];
  for (let i = 0; i < lines.length; i += 1) {
    const buffer = await synthesizeSpeech(lines[i], lang.ttsCode);
    const filename = `${i}.mp3`;
    fs.writeFileSync(path.join(dir, filename), buffer);
    urls.push(`/audio/${recipe.id}/${langCode}/${filename}`);
  }

  fs.writeFileSync(mPath, JSON.stringify(urls, null, 2), "utf-8");
  return urls;
}

module.exports = { getOrCreateAudioManifest, AUDIO_DIR };
