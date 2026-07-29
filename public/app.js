// Recipes now live on the backend (server/data/recipes.json) and are
// fetched at load time. All content is a DRAFT pending review by a
// qualified Ayurvedic practitioner before any real-world use.

let RECIPES = [];
let LANGUAGES = [];
let UI_TEXT = {};
let RATINGS_AVERAGES = {};
let AMAZON_AFFILIATE_TAG = null;

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

// Adjustable text size for readability — older users in particular asked
// for this. Independent of the main render() cycle: it just sets the
// root font-size, and since most of style.css is written in rem units,
// everything downstream of the root scales proportionally with it.
const FONT_SCALES = [0.875, 1, 1.15, 1.3, 1.5];
const FONT_SCALE_STORAGE_KEY = "ayurrasoi_fontScaleIndex";

function getFontScaleIndex() {
  const stored = parseInt(localStorage.getItem(FONT_SCALE_STORAGE_KEY), 10);
  return Number.isInteger(stored) && stored >= 0 && stored < FONT_SCALES.length ? stored : 1;
}

function applyFontScale(index) {
  document.documentElement.style.fontSize = (16 * FONT_SCALES[index]) + "px";
  localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(index));
}

applyFontScale(getFontScaleIndex());

function fontSizeControls() {
  const wrap = el("div", "font-size-controls");
  const index = getFontScaleIndex();

  const minusBtn = el("button", "font-size-btn", "A-");
  minusBtn.type = "button";
  minusBtn.disabled = index === 0;
  minusBtn.title = "Decrease text size";
  minusBtn.onclick = () => { applyFontScale(Math.max(0, index - 1)); render(); };
  wrap.appendChild(minusBtn);

  const plusBtn = el("button", "font-size-btn", "A+");
  plusBtn.type = "button";
  plusBtn.disabled = index === FONT_SCALES.length - 1;
  plusBtn.title = "Increase text size";
  plusBtn.onclick = () => { applyFontScale(Math.min(FONT_SCALES.length - 1, index + 1)); render(); };
  wrap.appendChild(plusBtn);

  return wrap;
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
  { match: /ashwagandha/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/WithaniaFruit.jpg/330px-WithaniaFruit.jpg", alt: "Ashwagandha" },
  { match: /neem/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Neem_leaves.JPG/500px-Neem_leaves.JPG", alt: "Neem leaves" },
  { match: /aloe vera|aloe/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Aloe_vera_leaf_showing_the_gel_%281%29.JPG/500px-Aloe_vera_leaf_showing_the_gel_%281%29.JPG", alt: "Aloe vera leaf" },
  { match: /licorice|liquorice|mulethi/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Liquiritiae_radix_suessholzwurzel.jpg/500px-Liquiritiae_radix_suessholzwurzel.jpg", alt: "Licorice root (Mulethi)" },
  { match: /fenugreek|methi/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Fenugreek_seeds.jpg/500px-Fenugreek_seeds.jpg", alt: "Fenugreek seeds" },
  { match: /cinnamon/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Cinnamon_sticks_-_%281%29.jpg/500px-Cinnamon_sticks_-_%281%29.jpg", alt: "Cinnamon sticks" },
  { match: /clove/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Cloves_whole.JPG/500px-Cloves_whole.JPG", alt: "Cloves" },
  { match: /sesame/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Sesame_seeds.JPG/500px-Sesame_seeds.JPG", alt: "Sesame seeds" },
  { match: /coconut oil|coconut/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Coconut_Oil_%284404443713%29.jpg/500px-Coconut_Oil_%284404443713%29.jpg", alt: "Coconut oil" },
  { match: /rose water|rosewater|rose petal/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Rose_water_flask.jpg/500px-Rose_water_flask.jpg", alt: "Rose water" },
  { match: /hibiscus/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Hibiscus_rosa-sinensis_flower_2.JPG/500px-Hibiscus_rosa-sinensis_flower_2.JPG", alt: "Hibiscus flower" },
  { match: /onion/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Whole_onion.jpg/500px-Whole_onion.jpg", alt: "Onion" },
  { match: /garlic/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Allium_sativum_-_Garlic_-_01.jpg/500px-Allium_sativum_-_Garlic_-_01.jpg", alt: "Garlic" },
  { match: /saffron|kesar/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Saffron.JPG/500px-Saffron.JPG", alt: "Saffron strands" },
  { match: /nutmeg|jaiphal/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Nutmeg.jpg/500px-Nutmeg.jpg", alt: "Nutmeg" },
  { match: /curd|yogurt|yoghurt|dahi/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Yoghurt_in_bowl.jpg/500px-Yoghurt_in_bowl.jpg", alt: "Curd (Yogurt)" },
  { match: /besan|gram flour|chickpea flour/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Gram_flour_AvL.jpg/500px-Gram_flour_AvL.jpg", alt: "Besan (gram flour)" },
  { match: /multani mitti|fuller's earth|fullers earth/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Fuller%27s_earth_powder.jpg/500px-Fuller%27s_earth_powder.jpg", alt: "Multani mitti (Fuller's earth)" },
  { match: /shikakai/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Shikakai_%28Senegalia_rugata%29_seed_pods.jpg/500px-Shikakai_%28Senegalia_rugata%29_seed_pods.jpg", alt: "Shikakai pods" },
  { match: /reetha|ritha|soap ?nut/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Ritha_%28Sapindus_mukorossi%29_fruits.jpg/500px-Ritha_%28Sapindus_mukorossi%29_fruits.jpg", alt: "Reetha (soap nut)" },
  { match: /brahmi|bacopa/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Bacopa_monnieri_Brahmi_flower.jpg/500px-Bacopa_monnieri_Brahmi_flower.jpg", alt: "Brahmi (Bacopa monnieri)" },
  { match: /guduchi|giloy/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Giloy.jpg/330px-Giloy.jpg", alt: "Guduchi (Giloy) stem" },
  { match: /castor oil|castor seed|castor plant|castor/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Castor_oil_plant_seeds.jpg/330px-Castor_oil_plant_seeds.jpg", alt: "Castor oil plant seeds" },
  { match: /mustard oil|mustard seed|mustard/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Mustard_Seeds.JPG/330px-Mustard_Seeds.JPG", alt: "Mustard seeds" },
  { match: /barley/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Barley_Seeds.jpg/330px-Barley_Seeds.jpg", alt: "Barley grains" },
  { match: /\bdates\b|dried date/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Dried_dates_-_1.jpg/330px-Dried_dates_-_1.jpg", alt: "Dried dates" },
  { match: /raisins?|kishmish/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Raisins.jpg/330px-Raisins.jpg", alt: "Raisins" },
  { match: /almonds?/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Heap_of_almonds.jpg/330px-Heap_of_almonds.jpg", alt: "Almonds" },
  { match: /black salt|kala namak|rock salt/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Black_salt.jpg/330px-Black_salt.jpg", alt: "Black salt (kala namak)" },
  { match: /asafoetida|asafetida|hing/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Heing.JPG/330px-Heing.JPG", alt: "Asafoetida (hing)" },
  { match: /cucumber/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Cucumber_picture.jpg/330px-Cucumber_picture.jpg", alt: "Cucumber" },
  { match: /sandalwood|chandan/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Santalum_album_%28Chandan%29_in_Hyderabad%2C_AP_W_IMG_0023.jpg/330px-Santalum_album_%28Chandan%29_in_Hyderabad%2C_AP_W_IMG_0023.jpg", alt: "Sandalwood (Chandan) tree" },
  { match: /triphala/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Haritaki_%28Sanskrit-_%E0%A4%B9%E0%A4%B0%E0%A5%80%E0%A4%A4%E0%A4%95%E0%A5%80%29_%283308328291%29.jpg/330px-Haritaki_%28Sanskrit-_%E0%A4%B9%E0%A4%B0%E0%A5%80%E0%A4%A4%E0%A4%95%E0%A5%80%29_%283308328291%29.jpg", alt: "Triphala churna (Haritaki, one of its three fruits)" },
  { match: /shatavari/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Asparagus_racemosus.JPG/330px-Asparagus_racemosus.JPG", alt: "Shatavari (Asparagus racemosus) plant" },
  { match: /jatamansi|spikenard/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Nardostachys_jatamansi_rhizome_with_a_scale_to_asses_its_size_Photo_N_C_SHAH.jpg/330px-Nardostachys_jatamansi_rhizome_with_a_scale_to_asses_its_size_Photo_N_C_SHAH.jpg", alt: "Jatamansi rhizome" },
  { match: /tagara|indian valerian/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Valeriana_jatamansi_-_Chelsea_Physic_Garden_-_DSC02853.jpg/330px-Valeriana_jatamansi_-_Chelsea_Physic_Garden_-_DSC02853.jpg", alt: "Tagara (Indian valerian) plant" },
  { match: /punarnava/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Punar-nava_%28Telugu-_%E0%B0%AA%E0%B1%81%E0%B0%A8%E0%B0%B0%E0%B1%8D%E0%B0%A8%E0%B0%B5%29_%284938290660%29.jpg/330px-Punar-nava_%28Telugu-_%E0%B0%AA%E0%B1%81%E0%B0%A8%E0%B0%B0%E0%B1%8D%E0%B0%A8%E0%B0%B5%29_%284938290660%29.jpg", alt: "Punarnava plant" },
  { match: /manjistha|manjishtha|indian madder/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Manjishta_%28Telugu-_%E0%B0%AE%E0%B0%82%E0%B0%9C%E0%B0%BF%E0%B0%B7%E0%B1%8D%E0%B0%A0%29_%286331763392%29.jpg/330px-Manjishta_%28Telugu-_%E0%B0%AE%E0%B0%82%E0%B0%9C%E0%B0%BF%E0%B0%B7%E0%B1%8D%E0%B0%A0%29_%286331763392%29.jpg", alt: "Manjistha (Indian madder)" },
  { match: /guggul/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Commiphora_wightii_05.JPG/330px-Commiphora_wightii_05.JPG", alt: "Guggul (Commiphora wightii) tree" }
];
const DEFAULT_INGREDIENT_IMAGE = { url: "https://upload.wikimedia.org/wikipedia/commons/e/ed/Spices_%285466679811%29.jpg", alt: "Spices" };

function getIngredientImage(text) {
  return INGREDIENT_IMAGES.find((i) => i.match.test(text)) || DEFAULT_INGREDIENT_IMAGE;
}

// Wikimedia thumb URLs look like ".../commons/thumb/7/78/Filename.jpg/500px-Filename.jpg".
// Requesting an arbitrary larger width (e.g. bumping straight to 1000px)
// fails with a 400 if that exceeds the source image's real resolution,
// so instead this strips the "/thumb" segment and the trailing
// "/500px-Filename.jpg" part to link straight to the original file —
// always valid, and the truest "see it properly" version anyway. URLs
// that don't match the thumb pattern (the generic fallback photo) are
// already the original file, so they pass through unchanged.
function largeIngredientImageUrl(url) {
  const m = url.match(/^(.*\/commons)\/thumb\/(.+)\/\d+px-[^/]+$/);
  return m ? `${m[1]}/${m[2]}` : url;
}

// A single reusable lightbox overlay, attached directly to <body> rather
// than inside #app — render() wipes #app's innerHTML on every state
// change (e.g. typing a comment), which would otherwise close it.
function openImageLightbox(url, alt) {
  const overlay = el("div", "image-lightbox-overlay");
  const img = document.createElement("img");
  img.src = largeIngredientImageUrl(url);
  img.alt = alt;
  img.className = "image-lightbox-photo";
  overlay.appendChild(img);
  const close = () => overlay.remove();
  overlay.onclick = close;
  document.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
  });
  document.body.appendChild(overlay);
}

function ingredientPhoto(text, className) {
  const img = document.createElement("img");
  const info = getIngredientImage(text);
  img.src = info.url;
  img.alt = info.alt;
  img.className = className;
  img.style.cursor = "zoom-in";
  img.onclick = () => openImageLightbox(info.url, info.alt);
  return img;
}

// A clean product search phrase from an ingredient line — strips the
// trailing "— quantity" part (and any leading bullet), leaving something
// like "Ashwagandha (Withania somnifera) root powder" to search Amazon
// for. No per-ingredient curation needed; scales to every recipe.
function ingredientSearchTerm(text) {
  return text.split(/[—-]\s*(?:\d|a pinch|to taste)/i)[0].trim();
}

function amazonBuyLink(text) {
  const term = ingredientSearchTerm(text);
  const params = new URLSearchParams({ k: term });
  if (AMAZON_AFFILIATE_TAG) params.set("tag", AMAZON_AFFILIATE_TAG);
  return `https://www.amazon.com/s?${params.toString()}`;
}

function ingredientBuyLink(text, label) {
  const a = document.createElement("a");
  a.href = amazonBuyLink(text);
  a.target = "_blank";
  a.rel = "nofollow sponsored noopener";
  a.className = "ingredient-buy-link";
  a.textContent = label;
  a.title = label;
  return a;
}

const CATEGORY_DEFS = [
  { id: "all", key: "catAll" },
  { id: "digestion", key: "catDigestion" },
  { id: "immunity", key: "catImmunity" },
  { id: "cold-cough", key: "catColdCough" },
  { id: "vitality", key: "catVitality" },
  { id: "sleep", key: "catSleep" },
  { id: "stress", key: "catStress" },
  { id: "skin", key: "catSkin" },
  { id: "hair", key: "catHair" },
  { id: "joint-pain", key: "catJointPain" },
  { id: "womens-health", key: "catWomensHealth" },
  { id: "oral-care", key: "catOralCare" },
  { id: "eye-care", key: "catEyeCare" },
  { id: "weight-management", key: "catWeightManagement" },
  { id: "detox", key: "catDetox" }
];

const AGE_RANGES = ["Under 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const GENDER_OPTIONS = ["Female", "Male", "Non-binary"];

// "label" is the stable English key stored in the database and compared
// against in the personalization logic — never translated, so profile
// data stays meaningful regardless of which language it was saved in.
// "key" looks up the translated display text shown to the user.
// Matched against each recipe's (English) ingredient list — a hard
// exclude from suggestions, since an allergy is a safety issue, not a
// preference. Keep patterns broad enough to catch common phrasings
// ("dairy", "curd", "yogurt" all mean milk-derived, for instance).
const ALLERGY_OPTIONS = [
  { label: "Milk / Dairy", key: "allergyMilk", match: /milk|dairy|curd|yogurt|yoghurt|ghee|paneer/i },
  { label: "Honey", key: "allergyHoney", match: /honey/i },
  { label: "Nuts / Almonds", key: "allergyNuts", match: /almond|walnut|cashew|pistachio|\bnuts?\b/i },
  { label: "Sesame", key: "allergySesame", match: /sesame|\btil\b/i },
  { label: "Gluten / Wheat", key: "allergyGluten", match: /wheat|barley|gluten/i },
  { label: "Soy", key: "allergySoy", match: /soy/i },
  { label: "Mustard", key: "allergyMustard", match: /mustard/i }
];

// Matched against each recipe's (English) safety note — a soft warning
// shown alongside a suggestion, not a hard exclude, since this is a
// keyword match against free text, not a verified medical exclusion.
const CONCERN_OPTIONS = [
  { label: "Pregnant", key: "concernPregnant", match: /pregnan/i },
  { label: "Trying to conceive", key: "concernTryingToConceive", match: /pregnan/i },
  { label: "Diabetes", key: "concernDiabetes", match: /diabet/i },
  { label: "High blood pressure", key: "concernBloodPressure", match: /blood pressure|hypertension/i },
  { label: "On blood-thinning medication", key: "concernBloodThinning", match: /blood.?thin|anticoagul/i },
  { label: "Heart condition", key: "concernHeart", match: /\bheart\b/i },
  { label: "Thyroid condition", key: "concernThyroid", match: /thyroid/i },
  { label: "Autoimmune condition", key: "concernAutoimmune", match: /autoimmune/i }
];

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
  resetSuccess: false,
  completeProfileForm: { ageRange: "", gender: "", country: "" },
  completeProfileStatus: "idle",
  completeProfileError: "",
  viewingDashboard: false,
  dashboardData: null,
  dashboardStatus: "idle",
  dashboardError: "",
  viewingProfile: false,
  healthProfile: { lastPeriodDate: null, averageCycleLength: null, allergies: [], concerns: [], otherNotes: "" },
  healthProfileForm: { lastPeriodDate: "", averageCycleLength: "", allergies: [], concerns: [], otherNotes: "" },
  healthProfileStatus: "idle",
  healthProfileError: "",
  healthProfileSaved: false,
  viewingDigest: false,
  digestPreview: null,
  digestPreviewStatus: "idle",
  digestSubject: "Your AyurRasoi Weekly",
  digestTipTitle: "",
  digestTipText: "",
  digestSendConfirmed: false,
  digestSendStatus: "idle",
  digestSendResult: null,
  digestSendError: "",
  unsubscribeNotice: null
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

async function loadDashboard() {
  state.dashboardStatus = "loading";
  state.dashboardError = "";
  render();
  try {
    const res = await apiFetch("/api/admin/dashboard");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    state.dashboardData = data;
    state.dashboardStatus = "idle";
  } catch (err) {
    state.dashboardStatus = "error";
    state.dashboardError = err.message;
  }
  render();
}

async function loadDigestPreview() {
  state.digestPreviewStatus = "loading";
  state.digestSendConfirmed = false;
  state.digestSendResult = null;
  state.digestSendError = "";
  render();
  try {
    const res = await apiFetch("/api/admin/digest/preview");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    state.digestPreview = data;
    state.digestPreviewStatus = "idle";
  } catch (err) {
    state.digestPreviewStatus = "error";
    state.digestSendError = err.message;
  }
  render();
}

async function submitSendDigest() {
  if (!state.digestSendConfirmed) return;
  state.digestSendStatus = "loading";
  state.digestSendError = "";
  render();
  try {
    const res = await apiFetch("/api/admin/digest/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: state.digestSubject,
        tipTitle: state.digestTipTitle,
        tipText: state.digestTipText,
        confirm: true
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    state.digestSendResult = data;
    state.digestSendStatus = "idle";
    state.digestSendConfirmed = false;
  } catch (err) {
    state.digestSendStatus = "error";
    state.digestSendError = err.message;
  }
  render();
}

function profileToForm(profile) {
  return {
    lastPeriodDate: profile.lastPeriodDate || "",
    averageCycleLength: profile.averageCycleLength ? String(profile.averageCycleLength) : "",
    allergies: [...profile.allergies],
    concerns: [...profile.concerns],
    otherNotes: profile.otherNotes || ""
  };
}

async function loadHealthProfile() {
  try {
    const res = await apiFetch("/api/profile/health");
    if (res.ok) {
      state.healthProfile = await res.json();
      state.healthProfileForm = profileToForm(state.healthProfile);
    }
  } catch (err) {
    // Non-fatal — suggestions just run unpersonalized if this fails.
  }
}

async function submitHealthProfile() {
  const f = state.healthProfileForm;
  state.healthProfileStatus = "loading";
  state.healthProfileError = "";
  state.healthProfileSaved = false;
  render();
  try {
    const res = await apiFetch("/api/profile/health", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    state.healthProfile = data;
    state.healthProfileForm = profileToForm(data);
    state.healthProfileStatus = "idle";
    state.healthProfileSaved = true;
  } catch (err) {
    state.healthProfileStatus = "error";
    state.healthProfileError = err.message;
  }
  render();
}

async function clearHealthProfileData() {
  state.healthProfileStatus = "loading";
  render();
  try {
    await apiFetch("/api/profile/health", { method: "DELETE" });
    state.healthProfile = { lastPeriodDate: null, averageCycleLength: null, allergies: [], concerns: [], otherNotes: "" };
    state.healthProfileForm = profileToForm(state.healthProfile);
    state.healthProfileStatus = "idle";
    state.healthProfileSaved = false;
  } catch (err) {
    state.healthProfileStatus = "error";
    state.healthProfileError = err.message;
  }
  render();
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
  if (!f.ageRange || !f.gender || !f.country.trim()) {
    state.authStatus = "error";
    state.authError = UI_TEXT[state.lang].demographicsRequired;
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
    await Promise.all([loadRecipes(), loadFavorites(), loadRatingsAverages(), loadHealthProfile()]);
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
    await Promise.all([loadRecipes(), loadFavorites(), loadRatingsAverages(), loadHealthProfile()]);
  } catch (err) {
    state.authStatus = "error";
    state.authError = err.message;
  }
  render();
}

async function submitCompleteProfile() {
  const f = state.completeProfileForm;
  if (!f.ageRange || !f.gender || !f.country.trim()) {
    state.completeProfileStatus = "error";
    state.completeProfileError = UI_TEXT[state.lang].demographicsRequired;
    render();
    return;
  }
  state.completeProfileStatus = "loading";
  state.completeProfileError = "";
  render();
  try {
    const res = await apiFetch("/api/auth/demographics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    state.user = data.user;
    state.completeProfileStatus = "idle";
    await Promise.all([loadRecipes(), loadFavorites(), loadRatingsAverages(), loadHealthProfile()]);
  } catch (err) {
    state.completeProfileStatus = "error";
    state.completeProfileError = err.message;
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
  headerControls.appendChild(fontSizeControls());

  if (!state.openRecipe && !state.authView && state.user && !state.user.needsDemographics) {
    const profileBtn = el("button", "add-recipe-nav-btn", state.viewingProfile ? t.closeProfile : t.profileNav);
    profileBtn.onclick = () => { state.viewingProfile = !state.viewingProfile; render(); };
    headerControls.appendChild(profileBtn);
  }

  if (!state.openRecipe && !state.authView && state.user && state.user.isAdmin) {
    const addBtn = el("button", "add-recipe-nav-btn", state.addingRecipe ? t.addRecipeCancel : t.addRecipeNav);
    addBtn.onclick = () => { state.addingRecipe = !state.addingRecipe; render(); };
    headerControls.appendChild(addBtn);

    const dashboardBtn = el("button", "add-recipe-nav-btn", state.viewingDashboard ? "Close dashboard" : "Dashboard");
    dashboardBtn.onclick = () => {
      state.viewingDashboard = !state.viewingDashboard;
      if (state.viewingDashboard) loadDashboard();
      render();
    };
    headerControls.appendChild(dashboardBtn);

    const digestBtn = el("button", "add-recipe-nav-btn", state.viewingDigest ? "Close digest" : "Digest");
    digestBtn.onclick = () => {
      state.viewingDigest = !state.viewingDigest;
      if (state.viewingDigest) loadDigestPreview();
      render();
    };
    headerControls.appendChild(digestBtn);
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

  if (state.unsubscribeNotice) {
    const noticeKey = state.unsubscribeNotice === "1" ? "unsubscribeSuccess"
      : state.unsubscribeNotice === "invalid" ? "unsubscribeInvalid"
      : "unsubscribeErrorGeneric";
    const notice = el("p", "media-note", (t[noticeKey] || "") + "  ");
    const dismiss = document.createElement("a");
    dismiss.textContent = "×";
    dismiss.style.cursor = "pointer";
    dismiss.onclick = () => { state.unsubscribeNotice = null; render(); };
    notice.appendChild(dismiss);
    app.appendChild(notice);
  }

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

  if (state.user.needsDemographics) {
    app.appendChild(renderCompleteProfile(t));
    app.appendChild(renderFooter(t));
    return;
  }

  if (state.viewingDashboard && state.user.isAdmin) {
    app.appendChild(renderDashboard());
    app.appendChild(renderFooter(t));
    return;
  }

  if (state.viewingDigest && state.user.isAdmin) {
    app.appendChild(renderDigestComposer());
    app.appendChild(renderFooter(t));
    return;
  }

  if (state.viewingProfile) {
    app.appendChild(renderProfile(t));
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
  { re: /stomach|bloat|gas\b|indigestion|digest|acid reflux|acidity|constipat/i, category: "digestion" },
  { re: /can'?t sleep|sleep|insomnia|can'?t fall asleep|restless night/i, category: "sleep" },
  { re: /stress|anxious|anxiety|overwhelm|worried|nervous|mind racing/i, category: "stress" },
  { re: /joint|knee|muscle ache|muscle pain|stiff|arthritis|back pain/i, category: "joint-pain" },
  { re: /skin|acne|pimple|dry skin|glow|dull skin/i, category: "skin" },
  { re: /hair|scalp|dandruff|hair fall|hair loss/i, category: "hair" },
  { re: /period|menstrual|cramps|pms\b/i, category: "womens-health" },
  { re: /tooth|teeth|gum|bad breath|mouth/i, category: "oral-care" },
  { re: /eye strain|tired eyes|puffy eyes|eyes\b/i, category: "eye-care" },
  { re: /weight|metabolism|sluggish metabolism/i, category: "weight-management" },
  { re: /detox|cleanse|toxin|heavy feeling/i, category: "detox" },
  { re: /tired|energy|fatigue|exhaust|low stamina/i, category: "vitality" },
  { re: /immun|weak|run down|sick often|fever/i, category: "immunity" }
];

const MAX_SUGGESTIONS = 5;

// Hard exclude — an allergy is a safety issue, not a preference, so a
// conflicting recipe never appears in suggestions at all.
function recipeConflictsWithAllergies(recipe, allergies) {
  if (!allergies || !allergies.length) return false;
  const ingredientText = recipe.en.ingredients.join(" ");
  return ALLERGY_OPTIONS.some((opt) => allergies.includes(opt.label) && opt.match.test(ingredientText));
}

// Soft warning — a keyword match against the recipe's free-text safety
// note, not a verified medical exclusion, so conflicting recipes still
// appear but ranked lower and flagged.
function recipeConcernWarnings(recipe, concerns) {
  if (!concerns || !concerns.length) return [];
  const safetyText = recipe.en.safety || "";
  return CONCERN_OPTIONS.filter((opt) => concerns.includes(opt.label) && opt.match.test(safetyText)).map((opt) => opt.label);
}

// A rough single-purpose estimate, not a full cycle tracker — used only
// to proactively lean toward womens-health recipes around the user's
// estimated period when they haven't typed a specific mood/symptom.
function estimateInMenstrualPhase(profile) {
  if (!profile.lastPeriodDate || !profile.averageCycleLength) return false;
  const last = new Date(profile.lastPeriodDate + "T00:00:00");
  const today = new Date();
  const daysSince = Math.floor((today - last) / (1000 * 60 * 60 * 24));
  if (daysSince < 0) return false;
  return (daysSince % profile.averageCycleLength) < 5;
}

function suggestRecipesForMood(input) {
  const text = (input || "").toLowerCase();
  let matchedCategory = null;
  for (const rule of MOOD_RULES) {
    if (rule.re.test(text)) { matchedCategory = rule.category; break; }
  }
  if (!matchedCategory && !text.trim() && estimateInMenstrualPhase(state.healthProfile)) {
    matchedCategory = "womens-health";
  }

  const allergies = state.healthProfile.allergies || [];
  const concerns = state.healthProfile.concerns || [];
  const pool = (matchedCategory ? RECIPES.filter((r) => r.category === matchedCategory) : RECIPES)
    .filter((r) => !recipeConflictsWithAllergies(r, allergies));

  const ranked = pool
    .map((r) => ({
      recipe: r,
      average: (RATINGS_AVERAGES[r.id] && RATINGS_AVERAGES[r.id].average) || 0,
      concernWarnings: recipeConcernWarnings(r, concerns)
    }))
    .sort((a, b) => (a.concernWarnings.length - b.concernWarnings.length) || (b.average - a.average));

  return { matched: !!matchedCategory, suggestions: ranked.slice(0, MAX_SUGGESTIONS) };
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
  submitBtn.onclick = () => { state.moodPick = suggestRecipesForMood(state.moodInputText); render(); };
  wrap.appendChild(submitBtn);

  if (state.moodPick) {
    if (!state.moodPick.matched) wrap.appendChild(el("p", "media-note", t.moodNoMatch));
    if (!state.moodPick.suggestions.length) {
      wrap.appendChild(el("p", "no-results", t.moodNoSuggestions));
    }
    state.moodPick.suggestions.forEach(({ recipe, concernWarnings }) => {
      const cardWrap = el("div", "suggestion-card-wrap");
      if (concernWarnings.length) {
        const translated = concernWarnings.map((label) => translateOptionLabel(t, CONCERN_OPTIONS, label));
        cardWrap.appendChild(el("p", "suggestion-warning", t.concernWarningPrefix + translated.join(", ")));
      }
      const card = renderCard(recipe, t);
      card.onclick = () => { state.moodOpen = false; state.openRecipe = recipe.id; loadRatingForRecipe(recipe.id); render(); };
      cardWrap.appendChild(card);
      wrap.appendChild(cardWrap);
    });
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

// Shown to any signed-in user missing age range/gender/country — Google
// sign-ins skip the sign-up form entirely, and this also catches the
// handful of accounts that predate demographics being required. Blocks
// the rest of the app the same way the anonymous gate screen does.
function checkboxGroup(t, title, options, selectedList, onToggle) {
  const wrap = el("div", "form-field");
  wrap.appendChild(el("label", "form-label", title));
  const grid = el("div", "checkbox-grid");
  options.forEach((opt) => {
    const row = el("label", "checkbox-row");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = selectedList.includes(opt.label);
    box.onchange = () => onToggle(opt.label, box.checked);
    row.appendChild(box);
    row.appendChild(document.createTextNode(t[opt.key] || opt.label));
    grid.appendChild(row);
  });
  wrap.appendChild(grid);
  return wrap;
}

// English label -> translated display text, for showing a user's
// previously-saved (always-English) selections in their current language.
function translateOptionLabel(t, options, label) {
  const opt = options.find((o) => o.label === label);
  return opt ? (t[opt.key] || label) : label;
}

function renderProfile(t) {
  const wrap = el("div", "detail");
  const backBtn = el("button", "back-btn", t.back);
  backBtn.onclick = () => { state.viewingProfile = false; render(); };
  wrap.appendChild(backBtn);

  wrap.appendChild(el("h2", null, t.profileTitle));
  wrap.appendChild(el("p", "card-purpose", t.profilePrivacyNote));

  const f = state.healthProfileForm;

  wrap.appendChild(el("h4", null, t.profileCycleHeading));
  wrap.appendChild(el("p", "media-note", t.profileCycleHelp));
  wrap.appendChild(labeledInput(t.profileLastPeriodLabel, "date", f.lastPeriodDate, (v) => { f.lastPeriodDate = v; }));
  wrap.appendChild(labeledInput(t.profileCycleLengthLabel, "number", f.averageCycleLength, (v) => { f.averageCycleLength = v; }));

  wrap.appendChild(el("h4", null, t.profileAllergiesHeading));
  wrap.appendChild(checkboxGroup(t, t.profileAllergiesHelp, ALLERGY_OPTIONS, f.allergies, (label, checked) => {
    f.allergies = checked ? [...f.allergies, label] : f.allergies.filter((a) => a !== label);
  }));

  wrap.appendChild(el("h4", null, t.profileConcernsHeading));
  wrap.appendChild(checkboxGroup(t, t.profileConcernsHelp, CONCERN_OPTIONS, f.concerns, (label, checked) => {
    f.concerns = checked ? [...f.concerns, label] : f.concerns.filter((c) => c !== label);
  }));

  wrap.appendChild(labeledInput(t.profileOtherNotesLabel, "text", f.otherNotes, (v) => { f.otherNotes = v; }));

  if (state.healthProfileStatus === "error") {
    wrap.appendChild(el("p", "media-note error-note", t.authErrorPrefix + state.healthProfileError));
  }
  if (state.healthProfileSaved && state.healthProfileStatus === "idle") {
    wrap.appendChild(el("p", "media-note", t.profileSaved));
  }

  const saveBtn = el("button", "walkthrough-btn", state.healthProfileStatus === "loading" ? t.completeProfileSubmitting : t.profileSave);
  saveBtn.disabled = state.healthProfileStatus === "loading";
  saveBtn.onclick = submitHealthProfile;
  wrap.appendChild(saveBtn);

  const clearBtn = el("button", "walkthrough-btn secondary", t.profileClear);
  clearBtn.onclick = () => {
    if (window.confirm(t.profileClearConfirm)) clearHealthProfileData();
  };
  wrap.appendChild(clearBtn);

  return wrap;
}

function renderCompleteProfile(t) {
  const wrap = el("div", "detail gate-screen");
  wrap.appendChild(el("h2", null, t.completeProfileTitle));
  wrap.appendChild(el("p", "card-purpose", t.completeProfileMessage));

  const f = state.completeProfileForm;
  wrap.appendChild(labeledSelect(t.ageRangeLabel, AGE_RANGES, t.selectOption, f.ageRange, (v) => { f.ageRange = v; }));
  wrap.appendChild(labeledSelect(t.genderLabel, GENDER_OPTIONS, t.selectOption, f.gender, (v) => { f.gender = v; }));
  wrap.appendChild(labeledInput(t.countryLabel, "text", f.country, (v) => { f.country = v; }));

  if (state.completeProfileStatus === "error") {
    wrap.appendChild(el("p", "media-note error-note", t.authErrorPrefix + state.completeProfileError));
  }

  const submitBtn = el("button", "walkthrough-btn", state.completeProfileStatus === "loading" ? t.completeProfileSubmitting : t.completeProfileSubmit);
  submitBtn.disabled = state.completeProfileStatus === "loading";
  submitBtn.onclick = submitCompleteProfile;
  wrap.appendChild(submitBtn);

  const logOutBtn = el("button", "back-btn", t.logOut);
  logOutBtn.onclick = submitLogOut;
  wrap.appendChild(logOutBtn);

  return wrap;
}

// Admin-only analytics — deliberately kept English-only rather than run
// through the translation pipeline, since it's internal tooling for the
// site owner rather than user-facing content.
function statCard(label, value) {
  const card = el("div", "stat-card");
  card.appendChild(el("div", "stat-card-value", String(value)));
  card.appendChild(el("div", "stat-card-label", label));
  return card;
}

function statBarRow(label, count, maxCount) {
  const row = el("div", "stat-bar-row");
  row.appendChild(el("div", "stat-bar-label", label));
  const track = el("div", "stat-bar-track");
  const fill = el("div", "stat-bar-fill");
  fill.style.width = (maxCount > 0 ? (count / maxCount) * 100 : 0) + "%";
  track.appendChild(fill);
  row.appendChild(track);
  row.appendChild(el("div", "stat-bar-count", String(count)));
  return row;
}

function statBarGroup(title, rows) {
  const wrap = el("div", "stat-group");
  wrap.appendChild(el("h4", null, title));
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  rows.forEach((r) => wrap.appendChild(statBarRow(r.label, r.count, maxCount)));
  return wrap;
}

// Admin-only, English-only (internal tooling, same reasoning as the
// dashboard). Deliberately has real friction before the actual send —
// a confirmation checkbox that must be ticked, spelling out the exact
// recipient count, since this is the one place in the app that emails
// real users and there is no scheduled/automatic path to this action.
function renderDigestComposer() {
  const wrap = el("div", "detail");
  const backBtn = el("button", "back-btn", "← Back");
  backBtn.onclick = () => { state.viewingDigest = false; render(); };
  wrap.appendChild(backBtn);
  wrap.appendChild(el("h2", null, "Weekly digest"));

  if (state.digestPreviewStatus === "loading" && !state.digestPreview) {
    wrap.appendChild(el("p", "no-results", "Loading…"));
    return wrap;
  }

  const preview = state.digestPreview;
  if (preview) {
    wrap.appendChild(el("h4", null, "Recipe of the Day (automatic)"));
    wrap.appendChild(el("p", "card-purpose", preview.recipeOfDay ? `${preview.recipeOfDay.name} — ${preview.recipeOfDay.purpose}` : "None available."));

    wrap.appendChild(el("h4", null, "Ayurveda research picks (automatic, PubMed)"));
    if (preview.pubmedPicks.length) {
      const list = el("ul", "dashboard-list");
      preview.pubmedPicks.forEach((p) => {
        list.appendChild(el("li", null, `${p.label}: ${p.title}${p.journal ? " — " + p.journal : ""}`));
      });
      wrap.appendChild(list);
    } else {
      wrap.appendChild(el("p", "media-note", "No picks available right now."));
    }

    wrap.appendChild(el("h4", null, "Wellness tip (you write this)"));
    wrap.appendChild(labeledInput("Tip title", "text", state.digestTipTitle, (v) => { state.digestTipTitle = v; }));
    const tipWrap = el("div", "form-field");
    tipWrap.appendChild(el("label", "form-label", "Tip text"));
    const tipArea = document.createElement("textarea");
    tipArea.className = "add-recipe-textarea";
    tipArea.style.minHeight = "80px";
    tipArea.value = state.digestTipText;
    tipArea.oninput = (e) => { state.digestTipText = e.target.value; };
    tipWrap.appendChild(tipArea);
    wrap.appendChild(tipWrap);

    wrap.appendChild(labeledInput("Subject line", "text", state.digestSubject, (v) => { state.digestSubject = v; }));

    const recipientNote = el("p", "media-note");
    recipientNote.innerHTML = `This will send to <strong>${preview.recipientCount}</strong> opted-in subscriber${preview.recipientCount === 1 ? "" : "s"}.`;
    wrap.appendChild(recipientNote);

    if (state.digestSendResult) {
      const r = state.digestSendResult;
      wrap.appendChild(el("p", "media-note", `Sent to ${r.sent} of ${r.totalRecipients}.${r.failed.length ? " " + r.failed.length + " failed." : ""}`));
    }
    if (state.digestSendStatus === "error") {
      wrap.appendChild(el("p", "media-note error-note", state.digestSendError));
    }

    const confirmRow = el("label", "checkbox-row");
    const confirmBox = document.createElement("input");
    confirmBox.type = "checkbox";
    confirmBox.checked = state.digestSendConfirmed;
    confirmBox.onchange = (e) => { state.digestSendConfirmed = e.target.checked; render(); };
    confirmRow.appendChild(confirmBox);
    confirmRow.appendChild(document.createTextNode(`I understand this will immediately email all ${preview.recipientCount} subscribers.`));
    wrap.appendChild(confirmRow);

    const sendBtn = el("button", "walkthrough-btn", state.digestSendStatus === "loading" ? "Sending…" : `Send to ${preview.recipientCount} subscribers`);
    sendBtn.disabled = !state.digestSendConfirmed || state.digestSendStatus === "loading";
    sendBtn.onclick = submitSendDigest;
    wrap.appendChild(sendBtn);
  }

  return wrap;
}

function renderDashboard() {
  const wrap = el("div", "detail");
  const backBtn = el("button", "back-btn", "← Back");
  backBtn.onclick = () => { state.viewingDashboard = false; render(); };
  wrap.appendChild(backBtn);
  wrap.appendChild(el("h2", null, "Dashboard"));

  if (state.dashboardStatus === "loading" && !state.dashboardData) {
    wrap.appendChild(el("p", "no-results", "Loading…"));
    return wrap;
  }
  if (state.dashboardStatus === "error") {
    wrap.appendChild(el("p", "media-note error-note", state.dashboardError));
    return wrap;
  }
  const d = state.dashboardData;
  if (!d) return wrap;

  const cards = el("div", "stat-card-row");
  cards.appendChild(statCard("Total users", d.users.total));
  cards.appendChild(statCard("New (7 days)", d.users.newLast7Days));
  cards.appendChild(statCard("New (30 days)", d.users.newLast30Days));
  cards.appendChild(statCard("Recipes", d.recipeCount));
  cards.appendChild(statCard("Favorites saved", d.engagement.totalFavorites));
  cards.appendChild(statCard("Ratings submitted", d.engagement.totalRatings));
  cards.appendChild(statCard("Avg. rating", d.engagement.averageRatingOverall ? d.engagement.averageRatingOverall.toFixed(2) : "—"));
  wrap.appendChild(cards);

  wrap.appendChild(statBarGroup("Sign-up method", [
    { label: "Password", count: d.users.signupMethod.password },
    { label: "Google", count: d.users.signupMethod.google }
  ]));
  wrap.appendChild(statBarGroup("Age range", d.users.ageRangeBreakdown.map((r) => ({ label: r.label, count: r.count }))));
  wrap.appendChild(statBarGroup("Gender", d.users.genderBreakdown.map((r) => ({ label: r.label, count: r.count }))));
  wrap.appendChild(statBarGroup("Country", d.users.countryBreakdown.map((r) => ({ label: r.label, count: r.count }))));
  wrap.appendChild(statBarGroup("Favorites by category", d.engagement.categoryPopularity.map((r) => ({ label: r.category, count: r.count }))));

  if (d.engagement.topFavorited.length) {
    wrap.appendChild(el("h4", null, "Most favorited recipes"));
    const list = el("ol", "dashboard-list");
    d.engagement.topFavorited.forEach((r) => {
      list.appendChild(el("li", null, `${r.title} — ${r.count} favorite${r.count === 1 ? "" : "s"}`));
    });
    wrap.appendChild(list);
  }

  if (d.engagement.topRated.length) {
    wrap.appendChild(el("h4", null, "Top rated recipes"));
    const list = el("ol", "dashboard-list");
    d.engagement.topRated.forEach((r) => {
      list.appendChild(el("li", null, `${r.title} — ${r.average.toFixed(1)}★ (${r.count} rating${r.count === 1 ? "" : "s"})`));
    });
    wrap.appendChild(list);
  }

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
    li.appendChild(el("span", "ingredient-text", i));
    li.appendChild(ingredientBuyLink(recipe.en.ingredients[idx], t.buyLabel));
    ul.appendChild(li);
  });
  wrap.appendChild(ul);
  wrap.appendChild(el("p", "affiliate-disclosure", t.affiliateDisclosure));

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
const unsubscribedFromUrl = startupUrl.searchParams.get("unsubscribed");
if (unsubscribedFromUrl) {
  state.unsubscribeNotice = unsubscribedFromUrl;
  window.history.replaceState({}, "", startupUrl.pathname);
}

render();

Promise.all([
  apiFetch("/api/languages").then((res) => res.json()),
  apiFetch("/api/ui-text").then((res) => res.json()),
  apiFetch("/api/auth/me").then((res) => res.json()),
  apiFetch("/api/config").then((res) => res.json())
])
  .then(async ([languages, uiText, authMe, config]) => {
    LANGUAGES = languages;
    UI_TEXT = uiText;
    state.user = authMe.user;
    AMAZON_AFFILIATE_TAG = config.amazonAffiliateTag;
    if (state.user) await Promise.all([loadRecipes(), loadFavorites(), loadRatingsAverages(), loadHealthProfile()]);
    state.loading = false;
    render();
  })
  .catch((err) => {
    state.loading = false;
    document.getElementById("app").innerHTML =
      "<p style='padding:20px'>Failed to load the app: " + err.message + "</p>";
  });
