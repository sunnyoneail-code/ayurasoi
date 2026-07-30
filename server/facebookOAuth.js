// Manual OAuth2 flow via plain fetch calls, mirroring googleOAuth.js —
// no SDK dependency needed for a single provider.

const crypto = require("crypto");

const GRAPH_VERSION = "v19.0";

function getRedirectUri(req) {
  const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${base}/api/auth/facebook/callback`;
}

function buildAuthUrl(req, state) {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    redirect_uri: getRedirectUri(req),
    response_type: "code",
    scope: "email",
    state
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

async function exchangeCodeForProfile(req, code) {
  const tokenParams = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    client_secret: process.env.FACEBOOK_APP_SECRET,
    redirect_uri: getRedirectUri(req),
    code
  });
  const tokenRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${tokenParams.toString()}`);
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Facebook token exchange failed (${tokenRes.status}): ${text}`);
  }
  const tokenData = await tokenRes.json();

  const profileParams = new URLSearchParams({ fields: "id,name,email", access_token: tokenData.access_token });
  const profileRes = await fetch(`https://graph.facebook.com/me?${profileParams.toString()}`);
  if (!profileRes.ok) throw new Error(`Facebook profile fetch failed (${profileRes.status})`);
  const profile = await profileRes.json();

  if (!profile.email) {
    const err = new Error("This Facebook account has no email address to sign in with. Please use a different sign-in method.");
    err.code = "NO_EMAIL";
    throw err;
  }

  return {
    facebookId: profile.id,
    email: profile.email,
    name: profile.name || profile.email.split("@")[0]
  };
}

function randomState() {
  return crypto.randomBytes(16).toString("hex");
}

module.exports = { buildAuthUrl, exchangeCodeForProfile, randomState };
