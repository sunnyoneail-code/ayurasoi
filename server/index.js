require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const path = require("path");
const fs = require("fs");
const express = require("express");
const store = require("./recipeStore");
const { generateRecipeFromText } = require("./recipeExtractor");
const { LANGUAGES } = require("./languages");
const { getOrCreateAudioManifest } = require("./audioCache");

const app = express();
const PORT = process.env.PORT || 5173;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/videos", express.static(path.join(__dirname, "videos")));
app.use("/audio", express.static(path.join(__dirname, "audio")));

app.get("/api/recipes", (req, res) => {
  res.json(store.readRecipes());
});

app.get("/api/languages", (req, res) => {
  res.json(LANGUAGES);
});

app.get("/api/ui-text", (req, res) => {
  const uiTextPath = path.join(__dirname, "data", "uiText.json");
  if (!fs.existsSync(uiTextPath)) {
    return res.status(404).json({ error: "UI text hasn't been generated yet. Run server/scripts/generateTranslations.js." });
  }
  res.json(JSON.parse(fs.readFileSync(uiTextPath, "utf-8")));
});

app.post("/api/recipes/generate", async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Paste some recipe text first." });
  }
  try {
    const parsed = await generateRecipeFromText(text);
    const saved = store.addRecipe(parsed);
    res.json(saved);
  } catch (err) {
    const status = err.code === "NOT_A_RECIPE" ? 422 : 502;
    res.status(status).json({ error: err.message });
  }
});

app.post("/api/recipes/:id/audio", async (req, res) => {
  const { id } = req.params;
  const lang = (req.body && req.body.lang) || "en";
  const recipe = store.getRecipe(id);
  if (!recipe) return res.status(404).json({ error: "Recipe not found." });

  try {
    const lines = await getOrCreateAudioManifest(recipe, lang);
    res.json({ lines });
  } catch (err) {
    const status = err.code === "TTS_UNSUPPORTED" ? 422 : 502;
    res.status(status).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`AyurRasoi server running at http://localhost:${PORT}`);
});
