import nodemailer from "nodemailer"
import { users } from "../user/user.schema"
import { db } from "@db"

const transportConfig = {
  host: process.env.SMTP_SERVER,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
}

const transporter = nodemailer.createTransport(transportConfig)

export const postContact = async (request, reply) => {
  try {
    let { firstname, lastname, email, phone, object, content } =
      request.validated.body

    const [user] = await db
      .insert(users)
      .values({
        email: email,
        firstname: firstname ?? "",
        lastname: lastname ?? "",
        phone: phone,
        password: null,
        isActive: false,
      })
      .onConflictDoNothing({
        target: users.email,
      })
      .returning()

    object = object[0].label
    // 📩 Mail vers toi (admin)
    await transporter.sendMail({
      from: `"Site Pitaya Photo" <noreply@pitaya-photo.com>`,
      to: "esteban@pitaya-photo.com",
      subject: `Nouvelle demande : ${object || "Sans objet"}`,
      html: `
              <h2>Nouvelle demande de contact</h2>
              <p><strong>Prénom :</strong> ${firstname}</p>
              <p><strong>Nom :</strong> ${lastname}</p>
              <p><strong>Email :</strong> ${email}</p>
              <p><strong>Téléphone :</strong> ${phone || "Non renseigné"}</p>
              <p><strong>Objet :</strong> ${object || "Non renseigné"}</p>
              <p><strong>Message :</strong><br/>${content}</p>
            `,
    })

    // 📩 Mail vers le client (confirmation)
    await transporter.sendMail({
      from: `"Pitaya Photo" <noreply@pitaya-photo.com>`,
      to: email,
      subject: "Confirmation de votre demande",
      html: `
              <p>Bonjour ${firstname},</p>
              <p>Votre message a bien été reçu. Je vous répondrai dans les plus brefs délais.</p>
              <br/>
              <p><strong>Récapitulatif :</strong></p>
              <p><strong>Objet :</strong> ${object || "Non renseigné"}</p>
              <p><strong>Message :</strong><br/>${content}</p>
              <br/>
              <p>À bientôt,<br/>Pitaya Photo</p>
            `,
    })

    return reply.code(200).send({
      success: true,
      message:
        "Message envoyé, vous aller recevoir une confirmation de réception",
    })
  } catch (err) {
    request.log.error(err)

    return reply.code(500).send({
      success: false,
      message: "Erreur lors de l'envoi du message.",
    })
  }
}
