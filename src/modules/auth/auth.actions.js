import {
  findOrCreateGoogleUser,
  fetchGoogleUserInfo,
  sendVerificationMail,
  sendResetMail,
} from "./auth.service.js"
import { eq } from "drizzle-orm"
import { db } from "../../database/index.js"
import { users, emailTokens } from "../../database/schema.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

export const signIn = async (request, reply) => {
  try {
    if (request.validated.body.email !== "esteban.mansart@gmail.com") {
      return reply.code(403).send({
        success: false,
        message: "Cette fonctionnalité n'est pas encore accessible au public",
      })
    }
    const [userFound] = await db
      .select({ password: users.password, id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, request.validated.body.email))

    if (!userFound) {
      return reply
        .code(403)
        .send({ success: false, message: "Invalid credentials" })
    }

    const match = await bcrypt.compare(
      request.validated.body.password,
      userFound.password
    )
    if (!match) {
      return reply
        .code(403)
        .send({ success: false, message: "Invalid credentials" })
    }

    const token = await reply.jwtSign({
      id: userFound.id,
      email: userFound.email,
      role: userFound.role,
    })

    reply.setCookie("access_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    })

    return reply
      .status(200)
      .send({ success: true, message: "Connexion réussie !" })
  } catch (err) {
    request.log.error(err)
    return reply
      .code(500)
      .send({ success: false, message: "Erreur lors de la connexion" })
  }
}

export const signUp = async (request, reply) => {
  try {
    if (request.validated.body.email !== "esteban.mansart@gmail.com") {
      return reply.code(403).send({
        success: false,
        message: "Cette fonctionnalité n'est pas encore accessible au public",
      })
    }
    const hashed = await bcrypt.hash(request.validated.body.password, 10)

    const userFound = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, request.validated.body.email))

    if (userFound.length > 0) {
      return reply
        .code(409)
        .send({ success: false, message: "Cet email est déjà pris" })
    }

    const [insertedUser] = await db
      .insert(users)
      .values({
        email: request.validated.body.email,
        password: hashed,
        firstname: request.validated.body.firstname,
        lastname: request.validated.body.lastname,
      })
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        firstname: users.firstname,
      })

    const expiresInMs = 24 * 60 * 60 * 1000
    const expiresAt = new Date(Date.now() + expiresInMs)
    const verificationToken = await reply.jwtSign(
      {
        id: insertedUser.id,
        email: insertedUser.email,
        type: "email_verification",
      },
      {
        expiresIn: "24h",
      }
    )

    const [insertedEmailToken] = await db
      .insert(emailTokens)
      .values({
        userId: insertedUser.id,
        type: "email_verification",
        token: verificationToken,
        expiresAt,
      })
      .returning()

    const verificationUrl = `${process.env.FRONTEND_URL}/authentication/verify-email?token=${verificationToken}`

    sendVerificationMail(insertedUser, verificationUrl)

    const token = await reply.jwtSign({
      id: insertedUser.id,
      email: insertedUser.email,
      role: insertedUser.role,
    })

    reply.setCookie("access_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    })

    return reply.code(201).send({
      success: true,
      message:
        "Un email de vérification vous a été envoyé, il est valable 24h. Passé ce délai, rendez vous sur les paramètres du compte pour renvoyer un email de vérification",
    })
  } catch (err) {
    request.log.error(err)
    return reply
      .code(500)
      .send({ success: false, message: "Erreur lors de l'inscription" })
  }
}

export const signOut = async (request, reply) => {
  reply.clearCookie("access_token", {
    path: "/",
  })
  return reply
    .code(204)
    .send({ success: true, message: "Vous avez été déconnecté" })
}

export const forgotPassword = async (request, reply) => {
  if (request.validated.body.email !== "esteban.mansart@gmail.com") {
    return reply.code(403).send({
      success: false,
      message: "Cette fonctionnalité n'est pas encore accessible au public",
    })
  }
  try {
    const [userFound] = await db
      .select({
        email: users.email,
        id: users.id,
        role: users.role,
        firstname: users.firstname,
      })
      .from(users)
      .where(eq(users.email, request.validated.body.email))

    if (!userFound) {
      return reply
        .code(404)
        .send({ success: false, message: "Invalid credentials" })
    }

    const expiresInMs = 24 * 60 * 60 * 1000
    const expiresAt = new Date(Date.now() + expiresInMs)
    const verificationToken = await reply.jwtSign(
      {
        id: userFound.id,
        email: userFound.email,
        type: "reset_password",
      },
      {
        expiresIn: "24h",
      }
    )

    const [insertedEmailToken] = await db
      .insert(emailTokens)
      .values({
        userId: userFound.id,
        type: "reset_password",
        token: verificationToken,
        expiresAt,
      })
      .returning()

    const resetUrl = `${process.env.FRONTEND_URL}/authentication/reset-password?token=${verificationToken}`

    sendResetMail(userFound, resetUrl)

    return reply.code(200).send({ success: true, message: "Email envoyé" })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la réinitialisation du mot de passe",
    })
  }
}

export const resetPassword = async (request, reply) => {
  try {
    // 1. Vérification du token
    let payload
    try {
      payload = jwt.verify(request.validated.body.token, process.env.JWT_SECRET)
    } catch (err) {
      request.log.error("err", err)
      return reply.code(401).send({
        success: false,
        message: "Ce lien de vérification est invalide ou expiré",
      })
    }
    if (payload.type !== "reset_password") {
      return reply
        .code(401)
        .send({ success: false, message: "Type de token invalide" })
    }

    // 2. Vérification de l'existence du lien
    const [emailToken] = await db
      .select()
      .from(emailTokens)
      .where(eq(emailTokens.token, request.validated.body.token))
    if (!emailToken) {
      return reply.code(401).send({
        success: false,
        message: "Ce lien de vérification n'est plus valide",
      })
    }

    // 3. Vérification de l'expiration du token
    if (emailToken.expiresAt < new Date()) {
      return reply
        .code(401)
        .send({ success: false, message: "Ce lien de vérification a expiré" })
    }

    // 4. Changement du mot de passe
    const hashedPassword = await bcrypt.hash(
      request.validated.body.password,
      10
    )
    await db
      .update(users)
      .set({
        password: hashedPassword,
      })
      .where(eq(users.id, emailToken.userId))

    // 5. Invalidation du lien de réinitialisation
    await db.delete(emailTokens).where(eq(emailTokens.id, emailToken.id))

    return reply.code(200).send({
      success: true,
      message: "Votre mot de passe a bien été modifié",
    })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la réinitialisation du mot de passe",
    })
  }
}

export const verifyEmail = async (request, reply) => {
  try {
    const { token } = request.body

    if (!token) {
      return reply.code(401).send({
        success: false,
        message: "Lien de vérification invalide ou manquant",
      })
    }

    let payload
    try {
      payload = jwt.verify(request.body.token, process.env.JWT_SECRET)
    } catch (err) {
      request.log.error("err", err)
      return reply.code(401).send({
        success: false,
        message: "Ce lien de vérification est invalide ou expiré",
      })
    }

    if (payload.type !== "email_verification") {
      return reply
        .code(401)
        .send({ success: false, message: "Type de token invalide" })
    }

    // 2. Vérification en BDD
    const [emailToken] = await db
      .select()
      .from(emailTokens)
      .where(eq(emailTokens.token, token))

    if (!emailToken) {
      return reply.code(401).send({
        success: false,
        message: "Ce lien de vérification n'est plus valide",
      })
    }

    // 3. Expiration BDD (sécurité supplémentaire)
    if (emailToken.expiresAt < new Date()) {
      return reply
        .code(401)
        .send({ success: false, message: "Ce lien de vérification a expiré" })
    }

    // 4. Activation du compte
    const [userFound] = await db
      .update(users)
      .set({
        emailConfirmed: true,
      })
      .where(eq(users.id, emailToken.userId))
      .returning({ id: users.id, email: users.email, role: users.role })

    // 5. Invalidation du token (one-shot)
    await db.delete(emailTokens).where(eq(emailTokens.id, emailToken.id))

    const authToken = await reply.jwtSign({
      id: userFound.id,
      email: userFound.email,
      role: userFound.role,
    })

    reply.setCookie("access_token", authToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    })

    return reply.code(200).send({
      success: true,
      message: "Votre adresse email a bien été vérifiée",
    })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la vérification de l'email",
    })
  }
}

export const googleCallback = async (request, reply) => {
  try {
    // Récupérer le token OAuth
    const token =
      await request.server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(
        request
      )

    // Récupérer les infos utilisateur Google
    const googleUserInfo = await fetchGoogleUserInfo(token.token.access_token)

    // Trouver ou créer l'utilisateur
    const user = await findOrCreateGoogleUser(googleUserInfo)

    if (user.email !== "esteban.mansart@gmail.com") {
      return reply.code(403).send({
        success: false,
        message: "Cette fonctionnalité n'est pas encore accessible au public",
      })
    }

    // Créer le JWT de session
    const sessionToken = request.server.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    })

    reply.setCookie("access_token", sessionToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    })

    // Redirection vers le frontend
    return reply.redirect(
      `${process.env.FRONTEND_URL}/authentication/sign-in-success`
    )
  } catch (err) {
    request.log?.error(err)
    return reply.redirect(
      `${process.env.FRONTEND_URL}/authentication/sign-in-error`
    )
  }
}
