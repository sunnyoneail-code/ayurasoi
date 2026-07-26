// Recipes now live on the backend (server/data/recipes.json) and are
// fetched at load time. All content is a DRAFT pending review by a
// qualified Ayurvedic practitioner before any real-world use.

let RECIPES = [];
let LANGUAGES = [];
let UI_TEXT = {};

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

const ICONS = [
  { match: /milk/i, icon: "🥛" },
  { match: /honey/i, icon: "🍯" },
  { match: /jaggery/i, icon: "🍬" },
  { match: /ginger/i, icon: "🫚" },
  { match: /pepper|pippali/i, icon: "🌶️" },
  { match: /tulsi|basil/i, icon: "🌿" },
  { match: /cardamom/i, icon: "🌱" },
  { match: /water/i, icon: "💧" },
  { match: /cumin|coriander|fennel|seed/i, icon: "🌰" },
  { match: /turmeric/i, icon: "🟠" },
  { match: /amla|gooseberry/i, icon: "🍈" },
  { match: /triphala|churna|powder/i, icon: "🥄" }
];

function getIngredientIcon(text) {
  const found = ICONS.find((i) => i.match.test(text));
  return found ? found.icon : "🌾";
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
  authError: ""
};

function resetAuthForm() {
  state.authForm = { name: "", email: "", password: "", confirmPassword: "", ageRange: "", gender: "", country: "" };
  state.authStatus = "idle";
  state.authError = "";
}

async function submitSignUp() {
  const f = state.authForm;
  if (f.password !== f.confirmPassword) {
    state.authStatus = "error";
    state.authError = UI_TEXT[state.lang].passwordMismatch;
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
  } catch (err) {
    state.authStatus = "error";
    state.authError = err.message;
  }
  render();
}

async function submitLogOut() {
  await apiFetch("/api/auth/logout", { method: "POST" });
  state.user = null;
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

  if (!state.openRecipe && !state.authView) {
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

  if (state.openRecipe) {
    app.appendChild(renderDetail(state.openRecipe, t));
    app.appendChild(renderFooter(t));
    return;
  }

  if (state.addingRecipe) {
    app.appendChild(renderAddRecipe(t));
    app.appendChild(renderFooter(t));
    return;
  }

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
  app.appendChild(chipRow);

  const filtered = RECIPES.filter((r) => {
    const matchesCategory = state.category === "all" || r.category === state.category;
    const text = (r.en.name + " " + (r[state.lang] ? r[state.lang].name : "")).toLowerCase();
    const matchesSearch = text.includes(state.search.toLowerCase());
    return matchesCategory && matchesSearch;
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

function renderCard(recipe, t) {
  const card = el("div", "card");
  const cat = CATEGORY_DEFS.find((c) => c.id === recipe.category);
  const data = recipe[state.lang] || recipe.en;
  card.appendChild(el("span", "card-category", cat ? t[cat.key] : ""));
  card.appendChild(el("h3", null, data.name));
  card.appendChild(el("p", "card-purpose", data.purpose));
  card.onclick = () => { state.openRecipe = recipe.id; render(); };
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

function renderSignUp(t) {
  const wrap = el("div", "detail");
  const backBtn = el("button", "back-btn", t.back);
  backBtn.onclick = () => { state.authView = null; render(); };
  wrap.appendChild(backBtn);

  wrap.appendChild(el("h2", null, t.signUpTitle));

  const f = state.authForm;
  wrap.appendChild(labeledInput(t.nameLabel, "text", f.name, (v) => { f.name = v; }));
  wrap.appendChild(labeledInput(t.emailLabel, "email", f.email, (v) => { f.email = v; }));
  wrap.appendChild(labeledInput(t.passwordLabel, "password", f.password, (v) => { f.password = v; }));
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

  const switchLink = el("p", "card-purpose switch-link", t.switchToSignUp);
  switchLink.onclick = () => { state.authView = "signup"; resetAuthForm(); render(); };
  wrap.appendChild(switchLink);

  return wrap;
}

function renderDetail(id, t) {
  const recipe = RECIPES.find((r) => r.id === id);
  const wrap = el("div", "detail");
  const backBtn = el("button", "back-btn", t.back);
  backBtn.onclick = () => { stopWalkthrough(); state.openRecipe = null; render(); };
  wrap.appendChild(backBtn);

  const data = recipe[state.lang] || recipe.en;
  wrap.appendChild(el("h2", null, data.name));
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
    li.appendChild(el("span", "ingredient-icon", getIngredientIcon(recipe.en.ingredients[idx])));
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

  return wrap;
}

function renderMedia(recipe, t) {
  const box = el("div", "media-box");
  box.appendChild(el("h4", null, t.visualLabel));

  const strip = el("div", "icon-strip");
  recipe.en.ingredients.forEach((ing, idx) => {
    const tile = el("div", "icon-tile");
    tile.dataset.ingredientIdx = idx;
    tile.appendChild(el("span", "icon-tile-emoji", getIngredientIcon(ing)));
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

render();

Promise.all([
  apiFetch("/api/recipes").then((res) => res.json()),
  apiFetch("/api/languages").then((res) => res.json()),
  apiFetch("/api/ui-text").then((res) => res.json()),
  apiFetch("/api/auth/me").then((res) => res.json())
])
  .then(([recipes, languages, uiText, authMe]) => {
    RECIPES = recipes;
    LANGUAGES = languages;
    UI_TEXT = uiText;
    state.user = authMe.user;
    state.loading = false;
    render();
  })
  .catch((err) => {
    state.loading = false;
    document.getElementById("app").innerHTML =
      "<p style='padding:20px'>Failed to load the app: " + err.message + "</p>";
  });
