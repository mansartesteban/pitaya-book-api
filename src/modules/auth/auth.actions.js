import { success, error, created } from "@lib/responses"
import { HttpStatus } from "@lib/httpStatus"
import {
  findOrCreateGoogleUser,
  fetchGoogleUserInfo,
  sendVerificationMail,
  sendResetMail,
} from "./auth.service"
import { eq } from "drizzle-orm"
import { db } from "@db"
import { users, emailTokens } from "@db/schema"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

export const signIn = async (request, reply) => {
  try {
    const [userFound] = await db
      .select({ password: users.password, id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, request.validated.body.email))

    if (!userFound) {
      return error(reply, HttpStatus.unauthorized("Invalid credentials"))
    }

    const match = await bcrypt.compare(
      request.validated.body.password,
      userFound.password
    )
    if (!match) {
      return error(reply, HttpStatus.unauthorized("Invalid credentials"))
    }

    const token = await reply.jwtSign({
      id: userFound.id,
      email: userFound.email,
      role: userFound.role,
    })

    return success(reply, { token })
  } catch (err) {
    request.log.error(err)
    return error(reply, HttpStatus.internalError)
  }
}

export const signUp = async (request, reply) => {
  try {
    const hashed = await bcrypt.hash(request.validated.body.password, 10)

    const userFound = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, request.validated.body.email))

    if (userFound.length > 0) {
      return error(reply, HttpStatus.conflict("Cet email est déjà pris"))
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

    return created(reply, {
      token,
      message:
        "Un email de vérification vous a été envoyé, il est valable 24h. Passé ce délai, rendez vous sur les paramètres du compte pour renvoyer un email de vérification",
    })
  } catch (err) {
    request.log.error(err)
    return error(reply, HttpStatus.internalError)
  }
}

export const forgotPassword = async (request, reply) => {
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
    return success(reply, { message: "Email envoyé" })
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

  return success(reply, { message: "Email envoyé" })
}

export const resetPassword = async (request, reply) => {
  try {
    // 1. Vérification du token
    let payload
    try {
      payload = jwt.verify(request.validated.body.token, process.env.JWT_SECRET)
    } catch (err) {
      return error(
        reply,
        HttpStatus.unauthorized(
          "Ce lien de vérification est invalide ou expiré"
        )
      )
    }
    if (payload.type !== "reset_password") {
      return error(reply, HttpStatus.unauthorized("Type de token invalide"))
    }

    // 2. Vérification de l'existence du lien
    const [emailToken] = await db
      .select()
      .from(emailTokens)
      .where(eq(emailTokens.token, request.validated.body.token))
    if (!emailToken) {
      return error(
        reply,
        HttpStatus.unauthorized("Ce lien de vérification n'est plus valide")
      )
    }

    // 3. Vérification de l'expiration du token
    if (emailToken.expiresAt < new Date()) {
      return error(
        reply,
        HttpStatus.unauthorized("Ce lien de vérification a expiré")
      )
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

    return success(reply, { message: "Votre mot de passe a bien été modifié" })
  } catch (err) {
    request.log.error(err)
    return error(reply, HttpStatus.internalError)
  }
}

export const verifyEmail = async (request, reply) => {
  try {
    const { token } = request.body

    if (!token) {
      return error(
        reply,
        HttpStatus.unauthorized("Lien de vérification invalide ou manquant")
      )
    }

    let payload
    try {
      payload = jwt.verify(request.body.token, process.env.JWT_SECRET)
    } catch {
      return error(
        reply,
        HttpStatus.unauthorized(
          "Ce lien de vérification est invalide ou expiré"
        )
      )
    }

    if (payload.type !== "email_verification") {
      return error(reply, HttpStatus.unauthorized("Type de token invalide"))
    }

    // 2. Vérification en BDD
    const [emailToken] = await db
      .select()
      .from(emailTokens)
      .where(eq(emailTokens.token, token))

    if (!emailToken) {
      return error(
        reply,
        HttpStatus.unauthorized("Ce lien de vérification n'est plus valide")
      )
    }

    // 3. Expiration BDD (sécurité supplémentaire)
    if (emailToken.expiresAt < new Date()) {
      return error(
        reply,
        HttpStatus.unauthorized("Ce lien de vérification a expiré")
      )
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

    return success(reply, {
      message: "Votre adresse email a bien été vérifiée",
      token: authToken,
    })
  } catch (err) {
    request.log.error(err)
    return error(reply, HttpStatus.internalError)
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

    // Créer le JWT de session
    const sessionToken = request.server.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    })

    // Redirection vers le frontend
    return reply.redirect(
      `${process.env.FRONTEND_URL}/authentication/sign-in-success?token=${sessionToken}`
    )
  } catch (err) {
    request.log?.error(err)
    return reply.redirect(
      `${process.env.FRONTEND_URL}/authentication/sign-in-error`
    )
  }
}
