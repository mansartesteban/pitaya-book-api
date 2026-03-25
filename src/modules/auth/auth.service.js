import { db } from "@db"
import { users } from "@db/schema"
import { Resend } from "resend"

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
      email: googleUserInfo.email,
      firstname: googleUserInfo.given_name ?? "",
      lastname: googleUserInfo.family_name ?? "",
      password: null,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { lastLoginAt: new Date() },
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
  const resend = new Resend(process.env.RESEND_TOKEN)

  const res = await resend.emails.send({
    from: "PITAYA INC <onboarding@resend.dev>",
    replyTo: "esteban.mansart@gmail.com",
    to: user.email,
    subject: "Vérification de votre compte Pitaya Inc",
    html: mailTemplates(user, verificationUrl)[0],
  })
}

export async function sendResetMail(user, resetUrl) {
  const resend = new Resend(process.env.RESEND_TOKEN)

  const res = await resend.emails.send({
    from: "PITAYA INC <onboarding@resend.dev>",
    replyTo: "esteban.mansart@gmail.com",
    to: user.email,
    subject: "Réinitilialisation de votre mot de passe Pitaya Inc",
    html: mailTemplates(user, resetUrl)[1],
  })

  console.log("resend sended", res)
}
