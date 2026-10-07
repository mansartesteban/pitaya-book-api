const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;")

export function galleryExpirationReminderMail({
  firstname, galleryTitle, expiresAt, galleryUrl, preferencesUrl,
  contactEmail = "esteban@pitaya-photo.com",
}) {
  const date = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris",
  }).format(expiresAt)
  const greeting = firstname?.trim() ? `Bonjour ${firstname.trim()},` : "Bonjour,"
  const subject = `Votre galerie « ${galleryTitle} » arrive bientôt à expiration`
  const text = `${greeting}

La période de mise à disposition de votre galerie « ${galleryTitle} » arrive à échéance le ${date}. Après cette date, son accès ou sa visibilité pourra être limité.

Vous pouvez la consulter ici : ${galleryUrl}

Si vous souhaitez prolonger sa disponibilité, écrivez-moi simplement à ${contactEmail} avant cette échéance. Je regarderai cela avec vous.

À bientôt,
Esteban Mansart
Pitaya Photo

Ce message concerne le suivi de votre galerie. Pour ne plus recevoir ces rappels : ${preferencesUrl}`

  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f7f5f1;color:#292524;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#fff;border:1px solid #ece7df;border-radius:16px">
    <tr><td style="padding:28px 32px;background:#292524;border-radius:16px 16px 0 0;color:#fff">
      <p style="margin:0 0 8px;color:#fbbf24;font-size:14px;font-weight:bold;letter-spacing:1px">PITAYA PHOTO</p>
      <h1 style="margin:0;font-size:25px;line-height:1.3">Votre galerie arrive à expiration</h1>
    </td></tr>
    <tr><td style="padding:32px;font-size:16px;line-height:1.65">
      <p style="margin:0 0 18px">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 18px">La période de mise à disposition de votre galerie <strong>« ${escapeHtml(galleryTitle)} »</strong> arrive à échéance le <strong>${escapeHtml(date)}</strong>.</p>
      <p style="margin:0 0 18px">Après cette date, son accès ou sa visibilité pourra être limité.</p>
      <p style="margin:0 0 24px">Vous pouvez encore la consulter et retrouver vos photos grâce au lien ci-dessous.</p>
      <p style="margin:0 0 28px"><a href="${escapeHtml(galleryUrl)}" style="display:inline-block;padding:13px 22px;border-radius:8px;background:#d97706;color:#fff;text-decoration:none;font-weight:bold">Voir ma galerie</a></p>
      <p style="margin:0 0 22px">Vous souhaitez prolonger sa disponibilité ? <a href="mailto:${escapeHtml(contactEmail)}" style="color:#b45309;font-weight:bold">Écrivez-moi</a> avant cette échéance ; je regarderai cela avec vous.</p>
      <p style="margin:28px 0 0">À bientôt,<br><strong>Esteban Mansart</strong><br>Pitaya Photo</p>
    </td></tr>
    <tr><td style="padding:20px 32px;border-top:1px solid #ece7df;color:#78716c;font-size:12px;line-height:1.5">
      Ce message concerne le suivi de votre galerie.<br>
      <a href="${escapeHtml(preferencesUrl)}" style="color:#78716c">Ne plus recevoir ces rappels</a>
    </td></tr>
  </table>
</body>
</html>`
  return { subject, text, html }
}
