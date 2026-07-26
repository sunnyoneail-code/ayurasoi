require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const store = require("./recipeStore");
const { generateRecipeFromText } = require("./recipeExtractor");
const { LANGUAGES } = require("./languages");
const { getOrCreateAudioManifest } = require("./audioCache");
const { hashPassword, verifyPassword } = require("./auth");
const users = require("./userStore");
const { initSchema } = require("./db");

const app = express();
const PORT = process.env.PORT || 5173;

// Auto-generated if not set — fine for a prototype, but note that it
// (like server/data/users.json) doesn't survive a restart on Render's
// free tier, so existing sessions/accounts reset along with everything
// else ephemeral in this deployment.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/videos", express.static(path.join(__dirname, "videos")));
app.use("/audio", express.static(path.join(__dirname, "audio")));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, demographics } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: "A valid email is required." });
    if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (await users.findByEmail(email)) return res.status(409).json({ error: "An account with this email already exists." });

    const user = await users.addUser({
      name: name.trim(),
      email: email.trim(),
      passwordHash: hashPassword(password),
      demographics: {
        ageRange: (demographics && demographics.ageRange) || "",
        gender: (demographics && demographics.gender) || "",
        country: (demographics && demographics.country) || ""
      }
    });
    req.session.userId = user.id;
    res.json({ user: users.toPublicUser(user) });
  } catch (err) {
    res.status(502).json({ error: "Couldn't create account: " + err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    const user = await users.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    req.session.userId = user.id;
    res.json({ user: users.toPublicUser(user) });
  } catch (err) {
    res.status(502).json({ error: "Couldn't sign in: " + err.message });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = await users.findById(req.session.userId);
  if (!user) return res.json({ user: null });
  res.json({ user: users.toPublicUser(user) });
});

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

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`AyurRasoi server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database schema:", err.message);
    app.listen(PORT, () => {
      console.log(`AyurRasoi server running at http://localhost:${PORT} (database schema init failed — see error above)`);
    });
  });
