// Manual OAuth2 flow via plain fetch calls — no passport dependency
// needed for a single provider.

const crypto = require("crypto");

function getRedirectUri(req) {
  const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${base}/api/auth/google/callback`;
}

function buildAuthUrl(req, state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForProfile(req, code) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(req)
    })
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${text}`);
  }
  const tokenData = await tokenRes.json();

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  if (!profileRes.ok) throw new Error(`Google profile fetch failed (${profileRes.status})`);
  const profile = await profileRes.json();

  return {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name || profile.email.split("@")[0]
  };
}

function randomState() {
  return crypto.randomBytes(16).toString("hex");
}

module.exports = { buildAuthUrl, exchangeCodeForProfile, randomState };
