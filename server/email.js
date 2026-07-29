// Sends transactional email via SendGrid's REST API directly (no SDK
// dependency needed — just one fetch call).

async function sendPasswordResetEmail(toEmail, resetLink) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    const err = new Error("Password reset email isn't configured on the server (SENDGRID_API_KEY / SENDGRID_FROM_EMAIL missing).");
    err.code = "EMAIL_NOT_CONFIGURED";
    throw err;
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail, name: "AyurRasoi" },
      subject: "Reset your AyurRasoi password",
      content: [
        {
          type: "text/plain",
          value: `Someone requested a password reset for this email address on AyurRasoi.\n\nIf this was you, click the link below (valid for 1 hour):\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.`
        },
        {
          type: "text/html",
          value: `<p>Someone requested a password reset for this email address on AyurRasoi.</p><p>If this was you, click the link below (valid for 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`
        }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SendGrid returned ${res.status}: ${text}`);
  }
}

async function sendDigestEmail(toEmail, toName, subject, { recipeSection, tipSection, newsSection }, unsubscribeLink) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    const err = new Error("Digest email isn't configured on the server (SENDGRID_API_KEY / SENDGRID_FROM_EMAIL missing).");
    err.code = "EMAIL_NOT_CONFIGURED";
    throw err;
  }

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color:#b5651d;">AyurRasoi Weekly</h2>
      <p>Hi ${toName},</p>
      ${recipeSection}
      ${tipSection}
      ${newsSection}
      <p style="margin-top:24px; font-size:0.8rem; color:#7a6a52;">
        Prototype content — not medical advice.<br>
        <a href="${unsubscribeLink}" style="color:#7a6a52;">Unsubscribe from these emails</a>
      </p>
    </div>`;

  const text = `AyurRasoi Weekly\n\nHi ${toName},\n\n(View this email in HTML for full formatting.)\n\nUnsubscribe: ${unsubscribeLink}`;

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail, name: toName }] }],
      from: { email: fromEmail, name: "AyurRasoi" },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SendGrid returned ${res.status}: ${errText}`);
  }
}

module.exports = { sendPasswordResetEmail, sendDigestEmail };
