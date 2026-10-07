import { db } from "../../database/index.js"
import { users } from "../../database/schema.js"
import nodemailer from "nodemailer"

const mailTemplates = (user, verificationUrl) => [
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
        <h1>Confirmez votre adresse email</h1>
      </div>

      <div class="content">
        <p>Bonjour${user.firstname ? ` ${user.firstname}` : ""},</p>

        <p>
          Merci pour votre inscription 🎉  
          Pour activer votre compte, merci de confirmer votre adresse email
          en cliquant sur le bouton ci-dessous.
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
  const [user] = await db
    .insert(users)
    .values({
      email: googleUserInfo.email.trim().toLowerCase(),
      firstname: googleUserInfo.given_name ?? "",
      lastname: googleUserInfo.family_name ?? "",
      password: null,
      emailConfirmed: true,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { lastLoginAt: new Date(), emailConfirmed: true },
    })
    .returning()

  return user
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

export async function sendVerificationMail(user, verificationUrl) {
  const transport = nodemailer.createTransport({ host: process.env.SMTP_SERVER,
    port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD } })
  await transport.sendMail({
    from: `Pitaya Photo <${process.env.SMTP_FROM || "noreply@pitaya-photo.com"}>`,
    replyTo: "esteban.mansart@gmail.com",
    to: user.email,
    subject: "Vérification de votre compte Pitaya Photo",
    html: mailTemplates(user, verificationUrl)[0],
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
