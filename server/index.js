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
const favorites = require("./favoritesStore");
const ratings = require("./ratingsStore");
const resetTokens = require("./resetTokenStore");
const { sendPasswordResetEmail, sendDigestEmail } = require("./email");
const googleOAuth = require("./googleOAuth");
const stats = require("./statsStore");
const healthProfiles = require("./healthProfileStore");
const digest = require("./digest");
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

// At least 8 characters with a letter and a number — matches the hint
// shown on the sign-up form, enforced here too so it can't be bypassed
// by calling the API directly.
function isPasswordStrong(password) {
  return typeof password === "string" && password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

// Admin status is computed from an env var, not stored on the user record —
// change who's an admin at any time just by editing ADMIN_EMAILS, no data
// migration needed. Comma-separated, case-insensitive.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function withAdminFlag(user) {
  if (!user) return null;
  return {
    ...user,
    isAdmin: ADMIN_EMAILS.includes(user.email.toLowerCase()),
    needsDemographics: !users.hasCompleteDemographics(user)
  };
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Sign in required." });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Sign in required." });
  users.findById(req.session.userId).then((user) => {
    if (!user || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return res.status(403).json({ error: "Admin access required." });
    }
    next();
  }).catch((err) => res.status(502).json({ error: err.message }));
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, demographics } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: "A valid email is required." });
    if (!isPasswordStrong(password)) return res.status(400).json({ error: "Password must be at least 8 characters and include a letter and a number." });
    if (!demographics || !demographics.ageRange || !demographics.gender || !demographics.country || !demographics.country.trim()) {
      return res.status(400).json({ error: "Age range, gender, and country are required." });
    }
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
    res.json({ user: withAdminFlag(users.toPublicUser(user)) });
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
    res.json({ user: withAdminFlag(users.toPublicUser(user)) });
  } catch (err) {
    res.status(502).json({ error: "Couldn't sign in: " + err.message });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  // Always return the same generic response whether or not the email
  // matches an account — prevents using this endpoint to check which
  // emails are registered.
  const generic = { ok: true, message: "If that email has an account, a reset link is on its way." };
  if (!email) return res.json(generic);
  try {
    const user = await users.findByEmail(email);
    if (user) {
      const token = await resetTokens.createResetToken(user.id);
      const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
      const resetLink = `${base}/?reset=${token}`;
      await sendPasswordResetEmail(user.email, resetLink);
    }
  } catch (err) {
    console.error("forgot-password error:", err.message);
  }
  res.json(generic);
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token) return res.status(400).json({ error: "Missing reset token." });
    if (!isPasswordStrong(newPassword)) {
      return res.status(400).json({ error: "Password must be at least 8 characters and include a letter and a number." });
    }
    const result = await resetTokens.consumeResetToken(token);
    if (!result.valid) {
      const messages = {
        not_found: "That reset link isn't valid.",
        used: "That reset link has already been used.",
        expired: "That reset link has expired — request a new one."
      };
      return res.status(400).json({ error: messages[result.reason] || "That reset link isn't valid." });
    }
    await users.setPasswordHash(result.userId, hashPassword(newPassword));
    res.json({ ok: true });
  } catch (err) {
    const status = err.code === "NO_DB" ? 501 : 502;
    res.status(status).json({ error: err.message });
  }
});

app.get("/api/auth/google", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).send("Google Sign-In isn't configured on this server yet.");
  }
  const state = googleOAuth.randomState();
  req.session.googleOAuthState = state;
  res.redirect(googleOAuth.buildAuthUrl(req, state));
});

app.get("/api/auth/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
  if (!code || !state || state !== req.session.googleOAuthState) {
    return res.redirect(`${base}/?authError=${encodeURIComponent("Google sign-in failed (invalid state). Please try again.")}`);
  }
  delete req.session.googleOAuthState;

  try {
    const profile = await googleOAuth.exchangeCodeForProfile(req, code);
    let user = await users.findByGoogleId(profile.googleId);
    if (!user) {
      user = await users.findByEmail(profile.email);
      if (user && !user.googleId) {
        // An account with this email already exists via password sign-up.
        // Since we can't attach googleId without a dedicated "link
        // accounts" flow, treat this as a normal login for that account.
      } else if (!user) {
        user = await users.addUser({
          name: profile.name,
          email: profile.email,
          passwordHash: null,
          googleId: profile.googleId,
          demographics: {}
        });
      }
    }
    req.session.userId = user.id;
    res.redirect(base + "/");
  } catch (err) {
    console.error("Google OAuth callback error:", err.message);
    res.redirect(`${base}/?authError=${encodeURIComponent("Couldn't complete Google sign-in. Please try again.")}`);
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = await users.findById(req.session.userId);
  if (!user) return res.json({ user: null });
  res.json({ user: withAdminFlag(users.toPublicUser(user)) });
});

// Fills in age range / gender / country for accounts that don't have them
// yet — Google sign-ins skip the sign-up form entirely, and a few
// accounts predate demographics being required, so this is the one place
// both paths converge before the app treats a profile as complete.
app.put("/api/auth/demographics", requireAuth, async (req, res) => {
  try {
    const { ageRange, gender, country } = req.body || {};
    if (!ageRange || !gender || !country || !country.trim()) {
      return res.status(400).json({ error: "Age range, gender, and country are required." });
    }
    const updated = await users.updateDemographics(req.session.userId, { ageRange, gender, country: country.trim() });
    res.json({ user: withAdminFlag(users.toPublicUser(updated)) });
  } catch (err) {
    res.status(502).json({ error: "Couldn't save that: " + err.message });
  }
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeStringList(list, maxItems, maxLength) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => typeof s === "string" && s.trim())
    .slice(0, maxItems)
    .map((s) => s.trim().slice(0, maxLength));
}

// Strictly the current user's own data — there is no admin/other-user
// read path for this route, and it never feeds into /api/admin/dashboard.
app.get("/api/profile/health", requireAuth, async (req, res) => {
  try {
    res.json(await healthProfiles.getProfile(req.session.userId));
  } catch (err) {
    const status = err.code === "NO_DB" ? 501 : 502;
    res.status(status).json({ error: err.message });
  }
});

app.put("/api/profile/health", requireAuth, async (req, res) => {
  try {
    const { lastPeriodDate, averageCycleLength, allergies, concerns, otherNotes } = req.body || {};
    if (lastPeriodDate && !DATE_RE.test(lastPeriodDate)) {
      return res.status(400).json({ error: "Last period date must be in YYYY-MM-DD format." });
    }
    const cycleLength = averageCycleLength ? Number(averageCycleLength) : null;
    if (cycleLength !== null && (!Number.isInteger(cycleLength) || cycleLength < 15 || cycleLength > 60)) {
      return res.status(400).json({ error: "Average cycle length should be a number of days between 15 and 60." });
    }
    const updated = await healthProfiles.upsertProfile(req.session.userId, {
      lastPeriodDate: lastPeriodDate || null,
      averageCycleLength: cycleLength,
      allergies: sanitizeStringList(allergies, 20, 60),
      concerns: sanitizeStringList(concerns, 20, 60),
      otherNotes: (otherNotes || "").trim().slice(0, 500)
    });
    res.json(updated);
  } catch (err) {
    const status = err.code === "NO_DB" ? 501 : 502;
    res.status(status).json({ error: "Couldn't save that: " + err.message });
  }
});

app.delete("/api/profile/health", requireAuth, async (req, res) => {
  try {
    await healthProfiles.clearProfile(req.session.userId);
    res.json({ ok: true });
  } catch (err) {
    const status = err.code === "NO_DB" ? 501 : 502;
    res.status(status).json({ error: err.message });
  }
});

app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  try {
    res.json(await stats.getDashboard());
  } catch (err) {
    const status = err.code === "NO_DB" ? 501 : 502;
    res.status(status).json({ error: err.message });
  }
});

// Compiles what a digest would contain right now — the automated parts
// (Recipe of the Day, PubMed picks) plus a recipient count — WITHOUT
// sending anything. The admin fills in the wellness tip client-side and
// only /api/admin/digest/send actually dispatches email.
app.get("/api/admin/digest/preview", requireAdmin, async (req, res) => {
  try {
    const recipeOfDay = digest.recipeOfDayForDate(new Date());
    const pubmedPicks = await digest.fetchPubMedPicks();
    const recipients = await users.listOptedInForDigest();
    res.json({
      recipeOfDay: recipeOfDay ? { id: recipeOfDay.id, name: recipeOfDay.en.name, purpose: recipeOfDay.en.purpose } : null,
      pubmedPicks,
      recipientCount: recipients.length
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// The one real "send a message on the user's behalf" action in this
// app — requires an explicit confirm:true from the admin every time
// (no scheduled/recurring auto-send), and reuses the exact PubMed picks
// and Recipe of the Day the admin already saw in the preview call.
app.post("/api/admin/digest/send", requireAdmin, async (req, res) => {
  try {
    const { subject, tipTitle, tipText, confirm } = req.body || {};
    if (!confirm) return res.status(400).json({ error: "Missing confirmation — this endpoint requires confirm: true." });
    if (!subject || !subject.trim()) return res.status(400).json({ error: "Subject is required." });

    const recipeOfDay = digest.recipeOfDayForDate(new Date());
    const pubmedPicks = await digest.fetchPubMedPicks();
    const content = digest.buildDigestContent({ tipTitle, tipText, recipeOfDay, pubmedPicks });
    const recipients = await users.listOptedInForDigest();
    const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;

    let sent = 0;
    const failed = [];
    for (const recipient of recipients) {
      try {
        const unsubscribeLink = digest.buildUnsubscribeLink(base, recipient.id);
        await sendDigestEmail(recipient.email, recipient.name, subject, content, unsubscribeLink);
        sent += 1;
      } catch (err) {
        failed.push({ email: recipient.email, error: err.message });
      }
    }
    res.json({ sent, failed, totalRecipients: recipients.length });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Public, no login required — email clients only support plain GET
// links. Verifies the HMAC token before flipping the opt-in flag, then
// redirects into the SPA so it can show a confirmation message.
app.get("/api/digest/unsubscribe", async (req, res) => {
  const { uid, token } = req.query;
  const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
  if (!uid || !token || !digest.verifyUnsubscribeToken(uid, token)) {
    return res.redirect(`${base}/?unsubscribed=invalid`);
  }
  try {
    await users.setEmailOptIn(uid, false);
    res.redirect(`${base}/?unsubscribed=1`);
  } catch (err) {
    res.redirect(`${base}/?unsubscribed=error`);
  }
});

app.get("/api/recipes", requireAuth, (req, res) => {
  res.json(store.readRecipes());
});

app.get("/api/languages", (req, res) => {
  res.json(LANGUAGES);
});

// Public, non-sensitive settings the frontend needs — currently just the
// Amazon Associates tracking ID for ingredient "buy" links. Left unset,
// the buy links still work (plain Amazon search, no affiliate credit)
// until a real tag is added to server/.env.
app.get("/api/config", (req, res) => {
  res.json({ amazonAffiliateTag: process.env.AMAZON_AFFILIATE_TAG || null });
});

app.get("/api/ui-text", (req, res) => {
  const uiTextPath = path.join(__dirname, "data", "uiText.json");
  if (!fs.existsSync(uiTextPath)) {
    return res.status(404).json({ error: "UI text hasn't been generated yet. Run server/scripts/generateTranslations.js." });
  }
  res.json(JSON.parse(fs.readFileSync(uiTextPath, "utf-8")));
});

app.post("/api/recipes/generate", requireAdmin, async (req, res) => {
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

app.post("/api/recipes/:id/audio", requireAuth, async (req, res) => {
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

app.get("/api/favorites", requireAuth, async (req, res) => {
  try {
    res.json({ recipeIds: await favorites.listFavorites(req.session.userId) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/recipes/:id/favorite", requireAuth, async (req, res) => {
  try {
    const result = await favorites.toggleFavorite(req.session.userId, req.params.id);
    res.json(result);
  } catch (err) {
    const status = err.code === "NO_DB" ? 501 : 502;
    res.status(status).json({ error: err.message });
  }
});

app.get("/api/ratings/averages", requireAuth, async (req, res) => {
  try {
    res.json(await ratings.getAllAverages());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/recipes/:id/ratings", requireAuth, async (req, res) => {
  try {
    const summary = await ratings.getRatingsForRecipe(req.params.id);
    const mine = await ratings.getUserRating(req.session.userId, req.params.id);
    res.json({ ...summary, myRating: mine });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/recipes/:id/rating", requireAuth, async (req, res) => {
  const { rating, comment } = req.body || {};
  const n = Number(rating);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    return res.status(400).json({ error: "Rating must be a whole number from 1 to 5." });
  }
  try {
    await ratings.upsertRating(req.session.userId, req.params.id, n, (comment || "").slice(0, 1000));
    const summary = await ratings.getRatingsForRecipe(req.params.id);
    res.json(summary);
  } catch (err) {
    const status = err.code === "NO_DB" ? 501 : 502;
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
