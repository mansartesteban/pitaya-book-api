import { db } from "../../database/index.js"
import { users } from "../../database/schema.js"
import nodemailer from "nodemailer"
import { eq } from "drizzle-orm"

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character])

const mailTemplates = (user, verificationUrl, options = {}) => [
  `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Vérification de votre adresse email</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f6f8fa;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
          Roboto, Helvetica, Arial, sans-serif;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }
      .header {
        background: #111827;
        color: #ffffff;
        padding: 24px;
        text-align: center;
      }
      .content {
        padding: 32px;
        color: #374151;
        line-height: 1.6;
      }
      .button {
        display: inline-block;
        margin: 24px 0;
        padding: 12px 24px;
        background: #2563eb;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
      }
      .footer {
        padding: 20px;
        font-size: 12px;
        color: #6b7280;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${options.galleryInvitation ? "Une galerie à gérer vous attend" : options.guestInteraction ? "Confirmez votre contribution" : "Confirmez votre adresse email"}</h1>
      </div>

      <div class="content">
        <p>Bonjour${user.firstname ? ` ${escapeHtml(user.firstname)}` : ""},</p>

        <p>
          ${options.galleryInvitation
            ? `Pitaya Photo vous propose de gérer la galerie « ${escapeHtml(options.galleryTitle)} ». Créez un compte avec cette adresse e-mail, puis confirmez-la pour accéder à la galerie depuis « Mes galeries ».`
            : options.guestInteraction
            ? "Pour publier votre réaction ou votre commentaire, confirmez votre adresse e-mail en cliquant sur le bouton ci-dessous. Vous pourrez ensuite contribuer pendant trente jours sans recevoir un nouveau courriel à chaque fois."
            : "Merci pour votre inscription 🎉 Pour activer votre compte, confirmez votre adresse e-mail en cliquant sur le bouton ci-dessous."}
        </p>

        <p style="text-align: center">
          <a href="${escapeHtml(verificationUrl)}" class="button">
            ${options.galleryInvitation ? "Créer mon compte" : options.guestInteraction ? "Confirmer ma contribution" : "Vérifier mon email"}
          </a>
        </p>

        <p>
          ${options.galleryInvitation ? "L'invitation restera liée à cette adresse e-mail jusqu'à ce que le propriétaire la retire." : "Ce lien est valable pour une durée limitée."}
          Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer
          cet email.
        </p>
      </div>

      <div class="footer">
        <p>
          © ${new Date().getFullYear()} — Pitaya Inc<br />
          Ceci est un email automatique, merci de ne pas y répondre.
        </p>
      </div>
    </div>
  </body>
</body>
</html>`,
  `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Réinitialisation de votre mot de passe</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f6f8fa;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
          Roboto, Helvetica, Arial, sans-serif;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }
      .header {
        background: #111827;
        color: #ffffff;
        padding: 24px;
        text-align: center;
      }
      .content {
        padding: 32px;
        color: #374151;
        line-height: 1.6;
      }
      .button {
        display: inline-block;
        margin: 24px 0;
        padding: 12px 24px;
        background: #2563eb;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
      }
      .footer {
        padding: 20px;
        font-size: 12px;
        color: #6b7280;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Changez votre mot de passe</h1>
      </div>

      <div class="content">
        <p>Bonjour${user.firstname ? ` ${user.firstname}` : ""},</p>

        <p>
        Pour définir un nouveau mot de passe, cliquez sur le lien ci-dessous :
        </p>

        <p style="text-align: center">
          <a href="${verificationUrl}" class="button">
            Vérifier mon email
          </a>
        </p>

        <p>
          Ce lien est valable pour une durée limitée.  
          Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer
          cet email.
        </p>
      </div>

      <div class="footer">
        <p>
          © ${new Date().getFullYear()} — Pitaya Inc<br />
          Ceci est un email automatique, merci de ne pas y répondre.
        </p>
      </div>
    </div>
  </body>
</body>
</html>`,
]

export async function findOrCreateGoogleUser(googleUserInfo) {
  const email = googleUserInfo.email.trim().toLowerCase()
  const [createdUser] = await db
    .insert(users)
    .values({
      email,
      firstname: googleUserInfo.given_name ?? "",
      lastname: googleUserInfo.family_name ?? "",
      password: null,
      emailConfirmed: false,
      isActive: true,
    })
    .onConflictDoNothing({ target: users.email })
    .returning()
  if (createdUser) return { user: createdUser, created: true }

  const [user] = await db.update(users).set({ lastLoginAt: new Date() })
    .where(eq(users.email, email)).returning()
  return { user, created: false }
}

export async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error("Failed to fetch Google user info")
  }

  return response.json()
}

// export function createEmailVerificationToken({ id, email }) {
//   return [
//     ,
//   ]
// }

export async function sendVerificationMail(user, verificationUrl, options = {}) {
  const transport = nodemailer.createTransport({ host: process.env.SMTP_SERVER,
    port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD } })
  await transport.sendMail({
    from: `Pitaya Photo <${process.env.SMTP_FROM || "noreply@pitaya-photo.com"}>`,
    replyTo: "esteban.mansart@gmail.com",
    to: user.email,
    subject: options.guestInteraction
      ? "Confirmez votre contribution à une galerie Pitaya Photo"
      : "Vérification de votre compte Pitaya Photo",
    html: mailTemplates(user, verificationUrl, options)[0],
  })
}

export async function sendResetMail(user, resetUrl) {
  const transport = nodemailer.createTransport({ host: process.env.SMTP_SERVER,
    port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD } })
  await transport.sendMail({
    from: `Pitaya Photo <${process.env.SMTP_FROM || "noreply@pitaya-photo.com"}>`,
    replyTo: "esteban.mansart@gmail.com",
    to: user.email,
    subject: "Réinitialisation de votre mot de passe Pitaya Photo",
    html: mailTemplates(user, resetUrl)[1],
  })
}

export async function sendGalleryManagementInvitation({ email, firstname, galleryTitle, signUpUrl }) {
  const transport = nodemailer.createTransport({ host: process.env.SMTP_SERVER,
    port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD } })
  await transport.sendMail({
    from: `Pitaya Photo <${process.env.SMTP_FROM || "noreply@pitaya-photo.com"}>`,
    replyTo: "esteban.mansart@gmail.com",
    to: email,
    subject: `Invitation à gérer la galerie « ${galleryTitle} »`,
    html: mailTemplates({ firstname }, signUpUrl, { galleryInvitation: true, galleryTitle })[0],
  })
}
