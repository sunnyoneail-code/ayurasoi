// Recipes now live on the backend (server/data/recipes.json) and are
// fetched at load time. All content is a DRAFT pending review by a
// qualified Ayurvedic practitioner before any real-world use.

let RECIPES = [];
let LANGUAGES = [];
let UI_TEXT = {};
let RATINGS_AVERAGES = {};

const ADD_RECIPE_PLACEHOLDER = "Name: Ginger tea for sore throat\nIngredients:\n- Ginger\n- Water\n- Honey\nSteps:\n1. Boil sliced ginger in water for 10 minutes.\n2. Add honey once warm.\n3. Drink twice a day.\nSource: Charaka Samhita\n\n(Keep the English words Name/Ingredients/Steps/Source — write everything else in whatever language you like.)";

// Always sent so that, when this app is shared through a localtunnel.me
// link, the tunnel's anti-abuse interstitial doesn't swallow the app's
// own API calls after a visitor clicks through the warning page once.
// Harmless no-op on any other host (including plain localhost).
function apiFetch(url, options) {
  const opts = options || {};
  opts.headers = Object.assign({ "bypass-tunnel-reminder": "true" }, opts.headers || {});
  return fetch(url, opts);
}

// Real photos (Wikipedia/Wikimedia Commons, freely licensed) instead of
// emoji — matched by keyword against the ingredient text, same approach
// as the old icon system just swapping what gets rendered.
const INGREDIENT_IMAGES = [
  { match: /milk/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Glass_of_Milk_%2833657535532%29.jpg/330px-Glass_of_Milk_%2833657535532%29.jpg", alt: "Milk" },
  { match: /honey/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Runny_hunny.jpg/330px-Runny_hunny.jpg", alt: "Honey" },
  { match: /jaggery/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Sa-indian-gud.jpg/330px-Sa-indian-gud.jpg", alt: "Jaggery" },
  { match: /ginger/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/GingerRoot_Novo_Los_Angeles.jpg/500px-GingerRoot_Novo_Los_Angeles.jpg", alt: "Ginger root" },
  { match: /pippali|long pepper/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Long_pepper_plant%28Piper_longum%29.JPG/500px-Long_pepper_plant%28Piper_longum%29.JPG", alt: "Long pepper (pippali)" },
  { match: /pepper/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Black_peppercorns_gn.jpg/500px-Black_peppercorns_gn.jpg", alt: "Black pepper" },
  { match: /tulsi|basil/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Tulsi_or_Tulasi_Holy_basil.jpg/330px-Tulsi_or_Tulasi_Holy_basil.jpg", alt: "Tulsi (holy basil)" },
  { match: /cardamom/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Cardamom_pods_-_Green_BNC.jpg/500px-Cardamom_pods_-_Green_BNC.jpg", alt: "Cardamom pods" },
  { match: /water/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Clean_water_for_a_village_in_West_Lombok_%2810686572086%29.jpg/330px-Clean_water_for_a_village_in_West_Lombok_%2810686572086%29.jpg", alt: "Water" },
  { match: /cumin/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Dried_cumin_seeds.jpg/500px-Dried_cumin_seeds.jpg", alt: "Cumin seeds" },
  { match: /coriander/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Coriander_Seeds.jpg/500px-Coriander_Seeds.jpg", alt: "Coriander seeds" },
  { match: /fennel/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Fennel_seeds_01.jpg/500px-Fennel_seeds_01.jpg", alt: "Fennel seeds" },
  { match: /turmeric/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Turmeric_Root_and_Turmeric_Powder.jpg/500px-Turmeric_Root_and_Turmeric_Powder.jpg", alt: "Turmeric" },
  { match: /amla|gooseberry/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Indian_Gooseberry_%28Amla%29.jpg/500px-Indian_Gooseberry_%28Amla%29.jpg", alt: "Amla (Indian gooseberry)" },
  { match: /ashwagandha/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/WithaniaFruit.jpg/330px-WithaniaFruit.jpg", alt: "Ashwagandha" }
];
const DEFAULT_INGREDIENT_IMAGE = { url: "https://upload.wikimedia.org/wikipedia/commons/e/ed/Spices_%285466679811%29.jpg", alt: "Spices" };

function getIngredientImage(text) {
  return INGREDIENT_IMAGES.find((i) => i.match.test(text)) || DEFAULT_INGREDIENT_IMAGE;
}

function ingredientPhoto(text, className) {
  const img = document.createElement("img");
  const info = getIngredientImage(text);
  img.src = info.url;
  img.alt = info.alt;
  img.className = className;
  return img;
}

const CATEGORY_DEFS = [
  { id: "all", key: "catAll" },
  { id: "digestion", key: "catDigestion" },
  { id: "immunity", key: "catImmunity" },
  { id: "cold-cough", key: "catColdCough" },
  { id: "vitality", key: "catVitality" }
];

const AGE_RANGES = ["Under 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const GENDER_OPTIONS = ["Female", "Male", "Non-binary"];

let state = {
  lang: "en",
  category: "all",
  search: "",
  openRecipe: null,
  loading: true,
  addingRecipe: false,
  addRecipeText: "",
  addRecipeStatus: "idle",
  addRecipeError: "",
  walkthroughPlaying: false,
  walkthroughLoading: false,
  walkthroughError: "",
  walkthroughStep: -1,
  user: null,
  authView: null,
  authForm: { name: "", email: "", password: "", confirmPassword: "", ageRange: "", gender: "", country: "" },
  authStatus: "idle",
  authError: "",
  favoriteIds: new Set(),
  showFavoritesOnly: false,
  ratingsCache: {},
  ratingDraft: 0,
  commentDraft: "",
  ratingStatus: "idle",
  ratingError: "",
  moodOpen: false,
  moodInputText: "",
  moodPick: null,
  forgotEmail: "",
  forgotStatus: "idle",
  forgotMessage: "",
  resetToken: null,
  resetPasswordDraft: "",
  resetConfirmDraft: "",
  resetStatus: "idle",
  resetError: "",
  resetSuccess: false
};

function resetAuthForm() {
  state.authForm = { name: "", email: "", password: "", confirmPassword: "", ageRange: "", gender: "", country: "" };
  state.authStatus = "idle";
  state.authError = "";
}

// Recipes are only fetched once someone has an account/session — the
// endpoint itself requires auth too, so this isn't just a UI nicety.
async function loadRecipes() {
  try {
    const res = await apiFetch("/api/recipes");
    if (res.ok) RECIPES = await res.json();
  } catch (err) {
    // Left for the gate/list screens to handle via empty RECIPES.
  }
}

async function loadFavorites() {
  try {
    const res = await apiFetch("/api/favorites");
    if (res.ok) {
      const data = await res.json();
      state.favoriteIds = new Set(data.recipeIds);
    }
  } catch (err) {
    // Non-fatal — favorites just show as empty if this fails.
  }
}

async function loadRatingsAverages() {
  try {
    const res = await apiFetch("/api/ratings/averages");
    if (res.ok) RATINGS_AVERAGES = await res.json();
  } catch (err) {
    // Non-fatal — cards just show no rating yet.
  }
}

async function loadRatingForRecipe(recipeId) {
  state.ratingDraft = 0;
  state.commentDraft = "";
  state.ratingStatus = "idle";
  state.ratingError = "";
  try {
    const res = await apiFetch(`/api/recipes/${recipeId}/ratings`);
    if (res.ok) {
      const data = await res.json();
      state.ratingsCache[recipeId] = data;
      if (data.myRating) {
        state.ratingDraft = data.myRating.rating;
        state.commentDraft = data.myRating.comment || "";
      }
      render();
    }
  } catch (err) {
    // Non-fatal — the detail view just shows no ratings yet.
  }
}

async function submitRating(recipeId) {
  if (!state.ratingDraft) return;
  state.ratingStatus = "loading";
  state.ratingError = "";
  render();
  try {
    const res = await apiFetch(`/api/recipes/${recipeId}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: state.ratingDraft, comment: state.commentDraft })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    state.ratingsCache[recipeId] = { ...data, myRating: { rating: state.ratingDraft, comment: state.commentDraft } };
    RATINGS_AVERAGES[recipeId] = { average: data.average, count: data.count };
    state.ratingStatus = "idle";
  } catch (err) {
    state.ratingStatus = "error";
    state.ratingError = err.message;
  }
  render();
}

async function toggleFavorite(recipeId) {
  const wasFavorited = state.favoriteIds.has(recipeId);
  if (wasFavorited) state.favoriteIds.delete(recipeId); else state.favoriteIds.add(recipeId);
  render();
  try {
    const res = await apiFetch(`/api/recipes/${recipeId}/favorite`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    if (data.favorited) state.favoriteIds.add(recipeId); else state.favoriteIds.delete(recipeId);
  } catch (err) {
    if (wasFavorited) state.favoriteIds.add(recipeId); else state.favoriteIds.delete(recipeId);
  }
  render();
}

function isPasswordStrong(password) {
  return typeof password === "string" && password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

async function submitSignUp() {
  const f = state.authForm;
  if (f.password !== f.confirmPassword) {
    state.authStatus = "error";
    state.authError = UI_TEXT[state.lang].passwordMismatch;
    render();
    return;
  }
  if (!isPasswordStrong(f.password)) {
    state.authStatus = "error";
    state.authError = UI_TEXT[state.lang].passwordHint;
    render();
    return;
  }
  state.authStatus = "loading";
  state.authError = "";
  render();
  try {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.name,
        email: f.email,
        password: f.password,
        demographics: { ageRange: f.ageRange, gender: f.gender, country: f.country }
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    state.user = data.user;
    state.authView = null;
    resetAuthForm();
    await Promise.all([loadRecipes(), loadFavorites(), loadRatingsAverages()]);
  } catch (err) {
    state.authStatus = "error";
    state.authError = err.message;
  }
  render();
}

async function submitSignIn() {
  const f = state.authForm;
  state.authStatus = "loading";
  state.authError = "";
  render();
  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.email, password: f.password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    state.user = data.user;
    state.authView = null;
    resetAuthForm();
    await Promise.all([loadRecipes(), loadFavorites(), loadRatingsAverages()]);
  } catch (err) {
    state.authStatus = "error";
    state.authError = err.message;
  }
  render();
}

async function submitForgotPassword() {
  state.forgotStatus = "loading";
  render();
  try {
    const res = await apiFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: state.forgotEmail })
    });
    const data = await res.json();
    state.forgotStatus = "sent";
    state.forgotMessage = data.message || UI_TEXT[state.lang].resetLinkSent;
  } catch (err) {
    state.forgotStatus = "sent";
    state.forgotMessage = UI_TEXT[state.lang].resetLinkSent;
  }
  render();
}

async function submitResetPassword() {
  if (state.resetPasswordDraft !== state.resetConfirmDraft) {
    state.resetStatus = "error";
    state.resetError = UI_TEXT[state.lang].passwordMismatch;
    render();
    return;
  }
  if (!isPasswordStrong(state.resetPasswordDraft)) {
    state.resetStatus = "error";
    state.resetError = UI_TEXT[state.lang].passwordHint;
    render();
    return;
  }
  state.resetStatus = "loading";
  render();
  try {
    const res = await apiFetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: state.resetToken, newPassword: state.resetPasswordDraft })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    state.resetStatus = "idle";
    state.resetSuccess = true;
  } catch (err) {
    state.resetStatus = "error";
    state.resetError = err.message;
  }
  render();
}

async function submitLogOut() {
  await apiFetch("/api/auth/logout", { method: "POST" });
  state.user = null;
  state.openRecipe = null;
  state.addingRecipe = false;
  state.favoriteIds = new Set();
  state.showFavoritesOnly = false;
  state.ratingsCache = {};
  RECIPES = [];
  render();
}

// Real generated audio files, played back the same way on every device —
// no dependence on whatever voices happen to be installed locally.
const player = new Audio();
let currentPlaylist = [];
let currentPlaylistKey = "";

player.addEventListener("ended", () => {
  if (state.walkthroughPlaying) playLineAt(state.walkthroughStep + 1);
});

function stopWalkthrough() {
  player.pause();
  player.removeAttribute("src");
  currentPlaylist = [];
  currentPlaylistKey = "";
  state.walkthroughPlaying = false;
  state.walkthroughLoading = false;
  state.walkthroughStep = -1;
}

function playLineAt(index) {
  if (index >= currentPlaylist.length) {
    stopWalkthrough();
    render();
    return;
  }
  state.walkthroughStep = index;
  render();
  player.src = currentPlaylist[index];
  player.play();
}

async function playWalkthrough(recipe) {
  stopWalkthrough();
  state.walkthroughLoading = true;
  state.walkthroughError = "";
  render();
  try {
    const res = await apiFetch(`/api/recipes/${recipe.id}/audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: state.lang })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    currentPlaylist = data.lines;
    currentPlaylistKey = recipe.id + ":" + state.lang;
    state.walkthroughLoading = false;
    state.walkthroughPlaying = true;
    playLineAt(0);
  } catch (err) {
    state.walkthroughLoading = false;
    state.walkthroughError = err.message;
    render();
  }
}

async function submitNewRecipe() {
  if (!state.addRecipeText.trim()) return;
  state.addRecipeStatus = "loading";
  state.addRecipeError = "";
  render();
  try {
    const res = await apiFetch("/api/recipes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: state.addRecipeText })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    RECIPES.push(data);
    state.addingRecipe = false;
    state.addRecipeText = "";
    state.addRecipeStatus = "idle";
    state.openRecipe = data.id;
    await loadRatingForRecipe(data.id);
  } catch (err) {
    state.addRecipeStatus = "error";
    state.addRecipeError = err.message;
  }
  render();
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function render() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  if (!UI_TEXT[state.lang]) {
    app.appendChild(el("p", "no-results", "Loading…"));
    return;
  }
  const t = UI_TEXT[state.lang];

  const header = el("header", "app-header");
  const titleRow = el("div", "title-row");
  const titleBlock = el("div");
  titleBlock.appendChild(el("h1", null, t.title));
  titleBlock.appendChild(el("p", "subtitle", t.subtitle));
  titleRow.appendChild(titleBlock);

  const headerControls = el("div", "header-controls");
  const langSelect = document.createElement("select");
  langSelect.className = "lang-select";
  LANGUAGES.forEach((lang) => {
    const opt = document.createElement("option");
    opt.value = lang.code;
    opt.textContent = lang.label;
    if (lang.code === state.lang) opt.selected = true;
    langSelect.appendChild(opt);
  });
  langSelect.onchange = (e) => { stopWalkthrough(); state.lang = e.target.value; render(); };
  headerControls.appendChild(langSelect);

  if (!state.openRecipe && !state.authView && state.user && state.user.isAdmin) {
    const addBtn = el("button", "add-recipe-nav-btn", state.addingRecipe ? t.addRecipeCancel : t.addRecipeNav);
    addBtn.onclick = () => { state.addingRecipe = !state.addingRecipe; render(); };
    headerControls.appendChild(addBtn);
  }

  if (state.user) {
    headerControls.appendChild(el("span", "welcome-text", t.welcomePrefix + state.user.name));
    const logOutBtn = el("button", "add-recipe-nav-btn", t.logOut);
    logOutBtn.onclick = submitLogOut;
    headerControls.appendChild(logOutBtn);
  } else {
    const signInBtn = el("button", "add-recipe-nav-btn", t.signIn);
    signInBtn.onclick = () => { state.authView = "signin"; resetAuthForm(); render(); };
    headerControls.appendChild(signInBtn);
    const signUpBtn = el("button", "add-recipe-nav-btn", t.signUp);
    signUpBtn.onclick = () => { state.authView = "signup"; resetAuthForm(); render(); };
    headerControls.appendChild(signUpBtn);
  }

  titleRow.appendChild(headerControls);
  header.appendChild(titleRow);
  app.appendChild(header);

  if (state.loading) {
    app.appendChild(el("p", "no-results", t.loading));
    return;
  }

  if (state.resetToken) {
    app.appendChild(renderResetPassword(t));
    app.appendChild(renderFooter(t));
    return;
  }

  if (state.authView === "signup") {
    app.appendChild(renderSignUp(t));
    app.appendChild(renderFooter(t));
    return;
  }

  if (state.authView === "signin") {
    app.appendChild(renderSignIn(t));
    app.appendChild(renderFooter(t));
    return;
  }

  if (state.authView === "forgot") {
    app.appendChild(renderForgotPassword(t));
    app.appendChild(renderFooter(t));
    return;
  }

  if (!state.user) {
    app.appendChild(renderGate(t));
    app.appendChild(renderFooter(t));
    return;
  }

  if (state.openRecipe) {
    app.appendChild(renderDetail(state.openRecipe, t));
    app.appendChild(renderFooter(t));
    return;
  }

  if (state.addingRecipe && state.user && state.user.isAdmin) {
    app.appendChild(renderAddRecipe(t));
    app.appendChild(renderFooter(t));
    return;
  }
  state.addingRecipe = false;

  if (state.moodOpen) {
    app.appendChild(renderMoodPicker(t));
    app.appendChild(renderFooter(t));
    return;
  }

  const recipeOfDay = pickRecipeOfDay();
  if (recipeOfDay && !state.search && state.category === "all" && !state.showFavoritesOnly) {
    app.appendChild(renderRecipeOfDayBanner(recipeOfDay, t));
  }

  const toolsRow = el("div", "tools-row");
  const moodBtn = el("button", "add-recipe-nav-btn", t.moodButton);
  moodBtn.onclick = () => { state.moodOpen = true; render(); };
  toolsRow.appendChild(moodBtn);
  app.appendChild(toolsRow);

  const searchInput = el("input", "search-input");
  searchInput.type = "text";
  searchInput.placeholder = t.searchPlaceholder;
  searchInput.value = state.search;
  searchInput.oninput = (e) => { state.search = e.target.value; render(); };
  app.appendChild(searchInput);

  const chipRow = el("div", "chip-row");
  CATEGORY_DEFS.forEach((c) => {
    const chip = el("button", "chip" + (state.category === c.id ? " active" : ""), t[c.key]);
    chip.onclick = () => { state.category = c.id; render(); };
    chipRow.appendChild(chip);
  });
  const favChip = el("button", "chip" + (state.showFavoritesOnly ? " active" : ""), "★ " + t.favoritesOnly);
  favChip.onclick = () => { state.showFavoritesOnly = !state.showFavoritesOnly; render(); };
  chipRow.appendChild(favChip);
  app.appendChild(chipRow);

  const filtered = RECIPES.filter((r) => {
    const matchesCategory = state.category === "all" || r.category === state.category;
    const text = (r.en.name + " " + (r[state.lang] ? r[state.lang].name : "")).toLowerCase();
    const matchesSearch = text.includes(state.search.toLowerCase());
    const matchesFavorite = !state.showFavoritesOnly || state.favoriteIds.has(r.id);
    return matchesCategory && matchesSearch && matchesFavorite;
  });

  const grid = el("div", "grid");
  if (filtered.length === 0) {
    grid.appendChild(el("p", "no-results", t.noResults));
  } else {
    filtered.forEach((r) => grid.appendChild(renderCard(r, t)));
  }
  app.appendChild(grid);
  app.appendChild(renderFooter(t));
}

// Deterministic pick so everyone sees the same "recipe of the day" and it
// only changes once per calendar day, without needing a backend endpoint.
function pickRecipeOfDay() {
  if (!RECIPES.length) return null;
  const today = new Date();
  const dayString = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  let hash = 0;
  for (let i = 0; i < dayString.length; i += 1) hash = (hash * 31 + dayString.charCodeAt(i)) >>> 0;
  return RECIPES[hash % RECIPES.length];
}

function renderRecipeOfDayBanner(recipe, t) {
  const data = recipe[state.lang] || recipe.en;
  const banner = el("div", "recipe-of-day");
  banner.appendChild(el("span", "card-category", "★ " + t.recipeOfDayLabel));
  banner.appendChild(el("h3", null, data.name));
  banner.appendChild(el("p", "card-purpose", data.purpose));
  banner.onclick = () => { state.openRecipe = recipe.id; loadRatingForRecipe(recipe.id); render(); };
  return banner;
}

const MOOD_RULES = [
  { re: /sore throat|cough|cold\b|congestion|flu|blocked nose/i, category: "cold-cough" },
  { re: /stomach|bloat|gas\b|indigestion|digest|acid|constipat/i, category: "digestion" },
  { re: /stress|anxious|anxiety|sleep|insomnia|tired|energy|fatigue|exhaust/i, category: "vitality" },
  { re: /immun|weak|run down|sick often|fever/i, category: "immunity" }
];

function suggestRecipeForMood(input) {
  const text = (input || "").toLowerCase();
  let matchedCategory = null;
  for (const rule of MOOD_RULES) {
    if (rule.re.test(text)) { matchedCategory = rule.category; break; }
  }
  const pool = matchedCategory ? RECIPES.filter((r) => r.category === matchedCategory) : RECIPES;
  if (!pool.length) return { recipe: null, matched: false };
  let best = pool[0];
  let bestScore = -1;
  pool.forEach((r) => {
    const avg = (RATINGS_AVERAGES[r.id] && RATINGS_AVERAGES[r.id].average) || 0;
    if (avg > bestScore) { bestScore = avg; best = r; }
  });
  return { recipe: best, matched: !!matchedCategory };
}

function renderMoodPicker(t) {
  const wrap = el("div", "detail");
  const backBtn = el("button", "back-btn", t.back);
  backBtn.onclick = () => { state.moodOpen = false; state.moodPick = null; render(); };
  wrap.appendChild(backBtn);
  wrap.appendChild(el("h2", null, t.moodTitle));
  wrap.appendChild(el("p", "card-purpose", t.moodHelp));

  const input = document.createElement("textarea");
  input.className = "add-recipe-textarea";
  input.style.minHeight = "60px";
  input.placeholder = t.moodPlaceholder;
  input.value = state.moodInputText;
  input.oninput = (e) => { state.moodInputText = e.target.value; };
  wrap.appendChild(input);

  const submitBtn = el("button", "walkthrough-btn", t.moodSubmit);
  submitBtn.onclick = () => { state.moodPick = suggestRecipeForMood(state.moodInputText); render(); };
  wrap.appendChild(submitBtn);

  if (state.moodPick) {
    if (!state.moodPick.matched) wrap.appendChild(el("p", "media-note", t.moodNoMatch));
    if (state.moodPick.recipe) {
      const card = renderCard(state.moodPick.recipe, t);
      const pickedId = state.moodPick.recipe.id;
      card.onclick = () => { state.moodOpen = false; state.openRecipe = pickedId; loadRatingForRecipe(pickedId); render(); };
      wrap.appendChild(card);
    }
  }

  return wrap;
}

function favoriteStarButton(recipeId, className) {
  const isFav = state.favoriteIds.has(recipeId);
  const btn = el("button", className + (isFav ? " favorited" : ""), isFav ? "★" : "☆");
  btn.setAttribute("aria-label", isFav ? UI_TEXT[state.lang].favoriteRemove : UI_TEXT[state.lang].favoriteAdd);
  btn.onclick = (e) => { e.stopPropagation(); toggleFavorite(recipeId); };
  return btn;
}

function ratingSummaryLine(recipeId, t) {
  const info = RATINGS_AVERAGES[recipeId];
  if (!info || !info.count) return el("p", "card-rating muted", t.noRatingsYet);
  return el("p", "card-rating", `★ ${info.average.toFixed(1)} · ${info.count} ${t.ratingsSuffix}`);
}

function renderCard(recipe, t) {
  const card = el("div", "card");
  const cat = CATEGORY_DEFS.find((c) => c.id === recipe.category);
  const data = recipe[state.lang] || recipe.en;
  const topRow = el("div", "card-top-row");
  topRow.appendChild(el("span", "card-category", cat ? t[cat.key] : ""));
  topRow.appendChild(favoriteStarButton(recipe.id, "favorite-star"));
  card.appendChild(topRow);
  card.appendChild(el("h3", null, data.name));
  card.appendChild(el("p", "card-purpose", data.purpose));
  card.appendChild(ratingSummaryLine(recipe.id, t));
  card.onclick = () => { state.openRecipe = recipe.id; loadRatingForRecipe(recipe.id); render(); };
  return card;
}

function renderAddRecipe(t) {
  const wrap = el("div", "detail");
  wrap.appendChild(el("h2", null, t.addRecipeTitle));
  wrap.appendChild(el("p", "card-purpose", t.addRecipeHelp));

  const textarea = document.createElement("textarea");
  textarea.className = "add-recipe-textarea";
  textarea.placeholder = ADD_RECIPE_PLACEHOLDER;
  textarea.value = state.addRecipeText;
  textarea.oninput = (e) => { state.addRecipeText = e.target.value; };
  wrap.appendChild(textarea);

  if (state.addRecipeStatus === "error") {
    wrap.appendChild(el("p", "media-note error-note", t.addRecipeErrorPrefix + state.addRecipeError));
  }

  const submitBtn = el("button", "walkthrough-btn", state.addRecipeStatus === "loading" ? t.addRecipeSubmitting : t.addRecipeSubmit);
  submitBtn.disabled = state.addRecipeStatus === "loading";
  submitBtn.onclick = submitNewRecipe;
  wrap.appendChild(submitBtn);

  return wrap;
}

function labeledInput(labelText, type, value, onInput) {
  const wrap = el("div", "form-field");
  wrap.appendChild(el("label", "form-label", labelText));
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  input.className = "add-recipe-textarea";
  input.style.minHeight = "auto";
  input.oninput = (e) => onInput(e.target.value);
  wrap.appendChild(input);
  return wrap;
}

function labeledSelect(labelText, options, placeholderText, value, onChange) {
  const wrap = el("div", "form-field");
  wrap.appendChild(el("label", "form-label", labelText));
  const select = document.createElement("select");
  select.className = "lang-select";
  select.style.maxWidth = "none";
  select.style.width = "100%";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = placeholderText;
  select.appendChild(blank);
  options.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    if (opt === value) o.selected = true;
    select.appendChild(o);
  });
  select.onchange = (e) => onChange(e.target.value);
  wrap.appendChild(select);
  return wrap;
}

function renderGate(t) {
  const wrap = el("div", "detail gate-screen");
  wrap.appendChild(el("h2", null, t.gateTitle));
  wrap.appendChild(el("p", "card-purpose", t.gateMessage));

  const btnRow = el("div", "walkthrough-controls");
  const signUpBtn = el("button", "walkthrough-btn", t.signUp);
  signUpBtn.onclick = () => { state.authView = "signup"; resetAuthForm(); render(); };
  btnRow.appendChild(signUpBtn);

  const signInBtn = el("button", "walkthrough-btn secondary", t.signIn);
  signInBtn.onclick = () => { state.authView = "signin"; resetAuthForm(); render(); };
  btnRow.appendChild(signInBtn);

  wrap.appendChild(btnRow);
  return wrap;
}

function googleButton() {
  const btn = document.createElement("a");
  btn.href = "/api/auth/google";
  btn.className = "walkthrough-btn secondary google-btn";
  btn.textContent = UI_TEXT[state.lang].continueWithGoogle;
  return btn;
}

function renderSignUp(t) {
  const wrap = el("div", "detail");
  const backBtn = el("button", "back-btn", t.back);
  backBtn.onclick = () => { state.authView = null; render(); };
  wrap.appendChild(backBtn);

  wrap.appendChild(el("h2", null, t.signUpTitle));
  wrap.appendChild(googleButton());
  wrap.appendChild(el("p", "or-divider", "—"));

  const f = state.authForm;
  wrap.appendChild(labeledInput(t.nameLabel, "text", f.name, (v) => { f.name = v; }));
  wrap.appendChild(labeledInput(t.emailLabel, "email", f.email, (v) => { f.email = v; }));
  wrap.appendChild(labeledInput(t.passwordLabel, "password", f.password, (v) => { f.password = v; }));
  wrap.appendChild(el("p", "password-hint", t.passwordHint));
  wrap.appendChild(labeledInput(t.confirmPasswordLabel, "password", f.confirmPassword, (v) => { f.confirmPassword = v; }));
  wrap.appendChild(labeledSelect(t.ageRangeLabel, AGE_RANGES, t.selectOption, f.ageRange, (v) => { f.ageRange = v; }));
  wrap.appendChild(labeledSelect(t.genderLabel, GENDER_OPTIONS, t.selectOption, f.gender, (v) => { f.gender = v; }));
  wrap.appendChild(labeledInput(t.countryLabel, "text", f.country, (v) => { f.country = v; }));

  if (state.authStatus === "error") {
    wrap.appendChild(el("p", "media-note error-note", t.authErrorPrefix + state.authError));
  }

  const submitBtn = el("button", "walkthrough-btn", state.authStatus === "loading" ? t.signUpSubmitting : t.signUpSubmit);
  submitBtn.disabled = state.authStatus === "loading";
  submitBtn.onclick = submitSignUp;
  wrap.appendChild(submitBtn);

  const switchLink = el("p", "card-purpose switch-link", t.switchToSignIn);
  switchLink.onclick = () => { state.authView = "signin"; resetAuthForm(); render(); };
  wrap.appendChild(switchLink);

  return wrap;
}

function renderSignIn(t) {
  const wrap = el("div", "detail");
  const backBtn = el("button", "back-btn", t.back);
  backBtn.onclick = () => { state.authView = null; render(); };
  wrap.appendChild(backBtn);

  wrap.appendChild(el("h2", null, t.signInTitle));
  wrap.appendChild(googleButton());
  wrap.appendChild(el("p", "or-divider", "—"));

  const f = state.authForm;
  wrap.appendChild(labeledInput(t.emailLabel, "email", f.email, (v) => { f.email = v; }));
  wrap.appendChild(labeledInput(t.passwordLabel, "password", f.password, (v) => { f.password = v; }));

  if (state.authStatus === "error") {
    wrap.appendChild(el("p", "media-note error-note", t.authErrorPrefix + state.authError));
  }

  const submitBtn = el("button", "walkthrough-btn", state.authStatus === "loading" ? t.signInSubmitting : t.signInSubmit);
  submitBtn.disabled = state.authStatus === "loading";
  submitBtn.onclick = submitSignIn;
  wrap.appendChild(submitBtn);

  const forgotLink = el("p", "card-purpose switch-link", t.forgotPassword);
  forgotLink.onclick = () => { state.authView = "forgot"; state.forgotEmail = f.email; state.forgotStatus = "idle"; render(); };
  wrap.appendChild(forgotLink);

  const switchLink = el("p", "card-purpose switch-link", t.switchToSignUp);
  switchLink.onclick = () => { state.authView = "signup"; resetAuthForm(); render(); };
  wrap.appendChild(switchLink);

  return wrap;
}

function renderForgotPassword(t) {
  const wrap = el("div", "detail");
  const backBtn = el("button", "back-btn", t.back);
  backBtn.onclick = () => { state.authView = "signin"; render(); };
  wrap.appendChild(backBtn);

  wrap.appendChild(el("h2", null, t.resetPasswordTitle));
  wrap.appendChild(el("p", "card-purpose", t.resetPasswordHelp));

  if (state.forgotStatus === "sent") {
    wrap.appendChild(el("p", "media-note", state.forgotMessage));
    return wrap;
  }

  wrap.appendChild(labeledInput(t.emailLabel, "email", state.forgotEmail, (v) => { state.forgotEmail = v; }));

  const submitBtn = el("button", "walkthrough-btn", t.sendResetLink);
  submitBtn.disabled = state.forgotStatus === "loading";
  submitBtn.onclick = submitForgotPassword;
  wrap.appendChild(submitBtn);

  return wrap;
}

function renderResetPassword(t) {
  const wrap = el("div", "detail");

  wrap.appendChild(el("h2", null, t.resetPasswordTitle));

  if (state.resetSuccess) {
    wrap.appendChild(el("p", "media-note", t.resetPasswordSuccess));
    const goSignIn = el("button", "walkthrough-btn", t.signIn);
    goSignIn.onclick = () => {
      state.resetToken = null;
      state.resetSuccess = false;
      const url = new URL(window.location.href);
      url.searchParams.delete("reset");
      window.history.replaceState({}, "", url);
      state.authView = "signin";
      resetAuthForm();
      render();
    };
    wrap.appendChild(goSignIn);
    return wrap;
  }

  wrap.appendChild(labeledInput(t.newPasswordLabel, "password", state.resetPasswordDraft, (v) => { state.resetPasswordDraft = v; }));
  wrap.appendChild(el("p", "password-hint", t.passwordHint));
  wrap.appendChild(labeledInput(t.confirmPasswordLabel, "password", state.resetConfirmDraft, (v) => { state.resetConfirmDraft = v; }));

  if (state.resetStatus === "error") {
    wrap.appendChild(el("p", "media-note error-note", state.resetError));
  }

  const submitBtn = el("button", "walkthrough-btn", t.resetPasswordSubmit);
  submitBtn.disabled = state.resetStatus === "loading";
  submitBtn.onclick = submitResetPassword;
  wrap.appendChild(submitBtn);

  return wrap;
}

function renderDetail(id, t) {
  const recipe = RECIPES.find((r) => r.id === id);
  const wrap = el("div", "detail");
  const backBtn = el("button", "back-btn", t.back);
  backBtn.onclick = () => { stopWalkthrough(); state.openRecipe = null; render(); };
  wrap.appendChild(backBtn);

  const data = recipe[state.lang] || recipe.en;
  const titleRow = el("div", "detail-title-row");
  titleRow.appendChild(el("h2", null, data.name));
  titleRow.appendChild(favoriteStarButton(recipe.id, "favorite-star large"));
  wrap.appendChild(titleRow);
  wrap.appendChild(el("p", "card-purpose", data.purpose));

  if (recipe.translationWarning) {
    wrap.appendChild(el("p", "media-note error-note", t.translationWarningPrefix + recipe.translationWarning));
  }

  const sourceBox = el("div", "source-box");
  sourceBox.appendChild(el("strong", null, t.sourceLabel + ": "));
  sourceBox.appendChild(document.createTextNode(recipe.source));
  wrap.appendChild(sourceBox);

  wrap.appendChild(el("h4", null, t.ingredientsLabel));
  const ul = el("ul", "ingredient-list");
  data.ingredients.forEach((i, idx) => {
    const li = el("li");
    li.appendChild(ingredientPhoto(recipe.en.ingredients[idx], "ingredient-photo"));
    li.appendChild(document.createTextNode(i));
    ul.appendChild(li);
  });
  wrap.appendChild(ul);

  wrap.appendChild(renderMedia(recipe, t));

  wrap.appendChild(el("h4", null, t.stepsLabel));
  const ol = el("ol");
  data.steps.forEach((s, idx) => {
    const li = el("li", state.walkthroughStep === idx + 1 ? "step-active" : null, s);
    ol.appendChild(li);
  });
  wrap.appendChild(ol);

  const safetyBox = el("div", "safety-box");
  safetyBox.appendChild(el("strong", null, "⚠ " + t.safetyLabel + ": "));
  safetyBox.appendChild(document.createTextNode(data.safety));
  wrap.appendChild(safetyBox);

  if (recipe.uncommonIngredient) {
    const uncommonName = recipe.uncommonIngredient.name[state.lang] || recipe.uncommonIngredient.name.en;
    const sourcingBox = el("div", "sourcing-box");
    sourcingBox.appendChild(el("strong", null, t.sourcingLabel + " (" + uncommonName + "):"));
    const linkList = el("ul");
    (recipe.uncommonIngredient.links || []).forEach((l) => {
      const li = el("li");
      if (l.url) {
        const a = el("a", null, l.label);
        a.href = l.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        li.appendChild(a);
      } else {
        li.appendChild(document.createTextNode(l.label));
      }
      linkList.appendChild(li);
    });
    sourcingBox.appendChild(linkList);
    wrap.appendChild(sourcingBox);
  }

  wrap.appendChild(renderRatings(recipe, t));

  return wrap;
}

function renderRatings(recipe, t) {
  const box = el("div", "ratings-box");
  box.appendChild(el("h4", null, t.ratingsLabel));

  const cached = state.ratingsCache[recipe.id];

  const starRow = el("div", "star-picker");
  starRow.appendChild(el("span", "form-label", t.yourRatingLabel));
  const stars = el("div");
  for (let i = 1; i <= 5; i += 1) {
    const starBtn = el("button", "star-pick-btn" + (i <= state.ratingDraft ? " picked" : ""), i <= state.ratingDraft ? "★" : "☆");
    starBtn.onclick = () => { state.ratingDraft = i; render(); };
    stars.appendChild(starBtn);
  }
  starRow.appendChild(stars);
  box.appendChild(starRow);

  const commentInput = document.createElement("textarea");
  commentInput.className = "add-recipe-textarea";
  commentInput.style.minHeight = "60px";
  commentInput.placeholder = t.commentPlaceholder;
  commentInput.value = state.commentDraft;
  commentInput.oninput = (e) => { state.commentDraft = e.target.value; };
  box.appendChild(commentInput);

  if (state.ratingStatus === "error") {
    box.appendChild(el("p", "media-note error-note", state.ratingError));
  }

  const submitBtn = el("button", "walkthrough-btn", t.submitRatingBtn);
  submitBtn.disabled = state.ratingStatus === "loading" || !state.ratingDraft;
  submitBtn.onclick = () => submitRating(recipe.id);
  box.appendChild(submitBtn);

  const commentsList = el("div", "comments-list");
  if (!cached || !cached.count) {
    commentsList.appendChild(el("p", "media-note", t.noRatingsYet));
  } else {
    cached.comments.forEach((c) => {
      const item = el("div", "comment-item");
      item.appendChild(el("div", "comment-header", `${"★".repeat(c.rating)}${"☆".repeat(5 - c.rating)} — ${c.userName}`));
      if (c.comment) item.appendChild(el("p", "comment-text", c.comment));
      commentsList.appendChild(item);
    });
  }
  box.appendChild(commentsList);

  return box;
}

function renderMedia(recipe, t) {
  const box = el("div", "media-box");
  box.appendChild(el("h4", null, t.visualLabel));

  const strip = el("div", "icon-strip");
  recipe.en.ingredients.forEach((ing, idx) => {
    const tile = el("div", "icon-tile");
    tile.dataset.ingredientIdx = idx;
    tile.appendChild(ingredientPhoto(ing, "icon-tile-photo"));
    strip.appendChild(tile);
  });
  box.appendChild(strip);
  box.appendChild(el("p", "media-note", t.visualNote));

  if (state.walkthroughPlaying && state.walkthroughStep >= 1) {
    const currentStepText = (recipe.en.steps[state.walkthroughStep - 1] || "").toLowerCase();
    Array.from(strip.children).forEach((tile) => {
      const ing = recipe.en.ingredients[Number(tile.dataset.ingredientIdx)] || "";
      const keyword = ing.split(/[—(]/)[0].trim().split(" ").pop().toLowerCase();
      if (keyword.length > 2 && currentStepText.includes(keyword)) tile.classList.add("icon-tile-active");
    });
  }

  const walkthroughTitle = el("h4", null, t.walkthroughLabel);
  walkthroughTitle.style.marginTop = "16px";
  box.appendChild(walkthroughTitle);

  const langMeta = LANGUAGES.find((l) => l.code === state.lang);
  if (langMeta && !langMeta.ttsCode) {
    box.appendChild(el("p", "media-note", t.voiceUnavailable));
    return box;
  }

  if (state.walkthroughError) {
    box.appendChild(el("p", "media-note error-note", t.audioErrorPrefix + state.walkthroughError));
  }

  const controls = el("div", "walkthrough-controls");
  const isActiveHere = currentPlaylistKey === recipe.id + ":" + state.lang;
  const playBtn = el(
    "button",
    "walkthrough-btn",
    state.walkthroughLoading ? t.loadingAudio : state.walkthroughPlaying && isActiveHere ? t.pause : t.play
  );
  playBtn.disabled = state.walkthroughLoading;
  playBtn.onclick = () => {
    if (state.walkthroughPlaying && isActiveHere) {
      player.pause();
      state.walkthroughPlaying = false;
      render();
    } else if (isActiveHere && currentPlaylist.length) {
      player.play();
      state.walkthroughPlaying = true;
      render();
    } else {
      playWalkthrough(recipe);
    }
  };
  controls.appendChild(playBtn);

  const stopBtn = el("button", "walkthrough-btn secondary", t.stop);
  stopBtn.onclick = () => { stopWalkthrough(); render(); };
  controls.appendChild(stopBtn);

  box.appendChild(controls);
  return box;
}

function renderFooter(t) {
  const footer = el("footer", "app-footer");
  footer.appendChild(el("p", null, t.disclaimer));
  return footer;
}

const startupUrl = new URL(window.location.href);
const resetTokenFromUrl = startupUrl.searchParams.get("reset");
if (resetTokenFromUrl) state.resetToken = resetTokenFromUrl;
const authErrorFromUrl = startupUrl.searchParams.get("authError");
if (authErrorFromUrl) {
  state.authView = "signin";
  state.authStatus = "error";
  state.authError = authErrorFromUrl;
  window.history.replaceState({}, "", startupUrl.pathname);
}

render();

Promise.all([
  apiFetch("/api/languages").then((res) => res.json()),
  apiFetch("/api/ui-text").then((res) => res.json()),
  apiFetch("/api/auth/me").then((res) => res.json())
])
  .then(async ([languages, uiText, authMe]) => {
    LANGUAGES = languages;
    UI_TEXT = uiText;
    state.user = authMe.user;
    if (state.user) await Promise.all([loadRecipes(), loadFavorites(), loadRatingsAverages()]);
    state.loading = false;
    render();
  })
  .catch((err) => {
    state.loading = false;
    document.getElementById("app").innerHTML =
      "<p style='padding:20px'>Failed to load the app: " + err.message + "</p>";
  });
