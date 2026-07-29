const crypto = require("crypto");
const store = require("./recipeStore");

// Same deterministic hash the frontend uses for "Recipe of the Day"
// (public/app.js pickRecipeOfDay) — ported here so the weekly digest
// shows the same pick a user would see in the app that day, not a
// separately-computed one.
function recipeOfDayForDate(date) {
  const recipes = store.readRecipes();
  if (!recipes.length) return null;
  const dayString = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 0;
  for (let i = 0; i < dayString.length; i += 1) hash = (hash * 31 + dayString.charCodeAt(i)) >>> 0;
  return recipes[hash % recipes.length];
}

// Two distinct, verified-reliable PubMed searches (free, keyless NCBI
// E-utilities API) rather than any individual journal's RSS feed — those
// proved fragile (redirects, platform moves, blocked scraping) when
// checked directly. "Multiple sources" here means multiple search
// angles on the same trustworthy, peer-reviewed index, not multiple
// unverified feeds.
const PUBMED_QUERIES = [
  { label: "Clinical research", term: "Ayurveda AND clinical trial" },
  { label: "Reviews & mechanisms", term: "Ayurveda AND review[pt]" }
];

async function fetchPubMedPicks() {
  const picks = [];
  for (const q of PUBMED_QUERIES) {
    try {
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q.term)}&sort=date&retmax=1&retmode=json`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      const id = searchData?.esearchresult?.idlist?.[0];
      if (!id) continue;

      const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${id}&retmode=json`;
      const summaryRes = await fetch(summaryUrl);
      const summaryData = await summaryRes.json();
      const doc = summaryData?.result?.[id];
      if (!doc) continue;

      picks.push({
        label: q.label,
        title: doc.title,
        journal: doc.fulljournalname || doc.source || "",
        pubDate: doc.pubdate || "",
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`
      });
    } catch (err) {
      // Non-fatal — a missing pick just means that section is skipped
      // for this week rather than blocking the whole digest.
    }
  }
  return picks;
}

// Stateless, non-expiring unsubscribe link — an HMAC of the user id, not
// a stored token, so no new table is needed and the link never goes
// stale as long as the secret stays the same.
function unsubscribeSecret() {
  return process.env.SESSION_SECRET || "ayurrasoi-unsubscribe-fallback";
}

function unsubscribeToken(userId) {
  return crypto.createHmac("sha256", unsubscribeSecret()).update(userId).digest("hex");
}

function verifyUnsubscribeToken(userId, token) {
  const expected = unsubscribeToken(userId);
  if (expected.length !== (token || "").length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

function buildUnsubscribeLink(baseUrl, userId) {
  return `${baseUrl}/api/digest/unsubscribe?uid=${encodeURIComponent(userId)}&token=${encodeURIComponent(unsubscribeToken(userId))}`;
}

function buildDigestContent({ tipTitle, tipText, recipeOfDay, pubmedPicks }) {
  const recipeSection = recipeOfDay
    ? `<h3 style="color:#b5651d;">Recipe of the Day: ${recipeOfDay.en.name}</h3><p>${recipeOfDay.en.purpose}</p>`
    : "";

  const tipSection = tipText
    ? `<h3 style="color:#b5651d;">${tipTitle || "This week's wellness tip"}</h3><p>${tipText}</p>`
    : "";

  const newsSection = pubmedPicks.length
    ? `<h3 style="color:#b5651d;">Recent Ayurveda research</h3><ul>${pubmedPicks
        .map((p) => `<li><strong>${p.label}:</strong> <a href="${p.url}">${p.title}</a>${p.journal ? ` — ${p.journal}` : ""}</li>`)
        .join("")}</ul>`
    : "";

  return { recipeSection, tipSection, newsSection };
}

module.exports = { recipeOfDayForDate, fetchPubMedPicks, unsubscribeToken, verifyUnsubscribeToken, buildUnsubscribeLink, buildDigestContent };
