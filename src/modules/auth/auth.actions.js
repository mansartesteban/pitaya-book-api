import {
  findOrCreateGoogleUser,
  fetchGoogleUserInfo,
  sendVerificationMail,
  sendResetMail,
} from "./auth.service.js"
import { and, desc, eq, gt } from "drizzle-orm"
import { db } from "../../database/index.js"
import { users, emailTokens, mobileLoginCodes, galleryInteractions } from "../../database/schema.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import crypto from "node:crypto"
import { notifyReply } from "../public/interactions/interaction.routes.js"
import { notifyAdminsOfNewUser } from "../notifications/accountNotifications.js"

const mobileCodeHash = (value) => crypto.createHash("sha256").update(value).digest("hex")
const mobileChallenge = (value) => crypto.createHash("sha256").update(value).digest("base64url")
const mobileFlowPattern = /^[A-Za-z0-9_-]{32,128}$/

export const startMobileGoogleSignIn = async (request, reply) => {
  const { state, challenge } = request.query ?? {}
  if (!mobileFlowPattern.test(state ?? "") || !mobileFlowPattern.test(challenge ?? "")) {
    return reply.code(400).send({ success: false, message: "Demande de connexion invalide" })
  }
  reply.setCookie("mobile_google_flow", `${state}.${challenge}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  })
  return reply.redirect("/api/auth/google")
}

export const exchangeMobileGoogleCode = async (request, reply) => {
  const { code, verifier } = request.body ?? {}
  if (!mobileFlowPattern.test(code ?? "") || !mobileFlowPattern.test(verifier ?? "")) {
    return reply.code(400).send({ success: false, message: "Code de connexion invalide" })
  }
  const [login] = await db.delete(mobileLoginCodes).where(and(
    eq(mobileLoginCodes.codeHash, mobileCodeHash(code)),
    eq(mobileLoginCodes.challenge, mobileChallenge(verifier)),
    gt(mobileLoginCodes.expiresAt, new Date()),
  )).returning({ userId: mobileLoginCodes.userId })
  if (!login) return reply.code(401).send({ success: false, message: "Code expiré ou déjà utilisé" })
  const [user] = await db.select({ id: users.id, email: users.email, role: users.role })
    .from(users).where(eq(users.id, login.userId))
  if (!user) return reply.code(401).send({ success: false, message: "Compte introuvable" })
  const sessionToken = await reply.jwtSign(user)
  reply.setCookie("access_token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })
  return reply.send({ success: true })
}

export const signIn = async (request, reply) => {
  try {
    const email = request.validated.body.email.trim().toLowerCase()
    const [userFound] = await db
      .select({ password: users.password, id: users.id, role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.email, email))

    if (!userFound?.isActive || !userFound.password) {
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
      email,
      role: userFound.role,
    })

    reply.setCookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
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
    const email = request.validated.body.email.trim().toLowerCase()
    const hashed = await bcrypt.hash(request.validated.body.password, 10)

    const userFound = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))

    if (userFound.length > 0) {
      return reply
        .code(409)
        .send({ success: false, message: "Cet email est déjà pris" })
    }

    const [insertedUser] = await db
      .insert(users)
      .values({
        email,
        password: hashed,
        firstname: request.validated.body.firstname,
        lastname: request.validated.body.lastname,
      })
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        firstname: users.firstname,
        lastname: users.lastname,
      })

    try { await notifyAdminsOfNewUser(insertedUser) }
    catch (error) { request.log.error(error, "Notification d'inscription impossible") }

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

    let verificationSent = true
    try { await sendVerificationMail(insertedUser, verificationUrl) }
    catch (error) { request.log.error(error); verificationSent = false }

    const token = await reply.jwtSign({
      id: insertedUser.id,
      email: insertedUser.email,
      role: insertedUser.role,
    })

    reply.setCookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })

    return reply.code(201).send({
      success: true,
      message: verificationSent
        ? "Un courriel de vérification vous a été envoyé. Le lien est valable 24 heures."
        : "Compte créé, mais le courriel de vérification n'a pas pu être envoyé. Vous pourrez le renvoyer depuis votre espace.",
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

export const resendVerification = async (request, reply) => {
  const [account] = await db.select({ id: users.id, email: users.email, firstname: users.firstname,
    emailConfirmed: users.emailConfirmed }).from(users).where(eq(users.id, request.user.id))
  if (!account) return reply.code(404).send({ success: false, message: "Compte introuvable" })
  if (account.emailConfirmed) return reply.send({ success: true, message: "Adresse déjà confirmée" })
  const [recent] = await db.select({ createdAt: emailTokens.createdAt }).from(emailTokens)
    .where(and(eq(emailTokens.userId, account.id), eq(emailTokens.type, "email_verification")))
    .orderBy(desc(emailTokens.createdAt)).limit(1)
  if (recent && Date.now() - recent.createdAt.getTime() < 60 * 1000) {
    return reply.code(429).send({ success: false, message: "Patientez une minute avant de renvoyer le courriel" })
  }
  const token = await reply.jwtSign({ id: account.id, email: account.email, type: "email_verification" }, { expiresIn: "24h" })
  await db.delete(emailTokens).where(and(eq(emailTokens.userId, account.id), eq(emailTokens.type, "email_verification")))
  await db.insert(emailTokens).values({ userId: account.id, type: "email_verification", token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
  await sendVerificationMail(account, `${process.env.FRONTEND_URL}/authentication/verify-email?token=${token}`)
  return reply.send({ success: true, message: "Courriel de vérification envoyé" })
}

export const forgotPassword = async (request, reply) => {
  try {
    const email = request.validated.body.email.trim().toLowerCase()
    const [userFound] = await db
      .select({
        email: users.email,
        id: users.id,
        role: users.role,
        firstname: users.firstname,
      })
      .from(users)
      .where(eq(users.email, email))

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

    await sendResetMail(userFound, resetUrl)

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
    if (!emailToken || emailToken.type !== "reset_password" || emailToken.userId !== payload.id) {
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

    if (payload.type === "guest_interaction_verification") {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
      const [confirmed] = await db.update(galleryInteractions).set({
        status: "PUBLISHED", confirmedAt: new Date(),
        verificationTokenHash: null, verificationExpiresAt: null,
      }).where(and(
        eq(galleryInteractions.id, payload.interactionId),
        eq(galleryInteractions.guestEmail, payload.email),
        eq(galleryInteractions.verificationTokenHash, tokenHash),
        eq(galleryInteractions.status, "PENDING"),
        gt(galleryInteractions.verificationExpiresAt, new Date()),
      )).returning({ id: galleryInteractions.id, galleryId: galleryInteractions.galleryId,
        email: galleryInteractions.guestEmail, name: galleryInteractions.guestName })
      if (!confirmed) return reply.code(410).send({ success: false, message: "Ce lien n'est plus valide" })
      const published = await db.update(galleryInteractions).set({ status: "PUBLISHED", confirmedAt: new Date(),
        verificationExpiresAt: null }).where(and(eq(galleryInteractions.guestEmail, confirmed.email),
        eq(galleryInteractions.status, "PENDING"), gt(galleryInteractions.verificationExpiresAt, new Date())))
        .returning({ id: galleryInteractions.id })
      for (const item of [confirmed, ...published]) await notifyReply(item.id)
      const guestSession = await reply.jwtSign({ type: "guest_interaction_session",
        email: confirmed.email, name: confirmed.name }, { expiresIn: "30d" })
      reply.setCookie("guest_interaction_session", guestSession, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60,
      })
      return reply.send({ success: true, message: "Votre adresse e-mail est vérifiée et votre contribution est publiée",
        data: { guest: true, galleryId: confirmed.galleryId, email: confirmed.email, name: confirmed.name } })
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

    if (!emailToken || emailToken.type !== "email_verification" || emailToken.userId !== payload.id) {
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

    const [currentAccount] = await db.select({ email: users.email }).from(users).where(eq(users.id, emailToken.userId))
    if (!currentAccount || currentAccount.email !== payload.email) {
      return reply.code(401).send({ success: false, message: "Cette adresse e-mail n'est plus celle du compte" })
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
      secure: process.env.NODE_ENV === "production",
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

export const getGuestInteractionSession = async (request, reply) => {
  try {
    const token = request.cookies?.guest_interaction_session
    if (!token) return reply.send({ success: true, data: { verified: false } })
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (payload.type !== "guest_interaction_session" || !payload.email) throw new Error("Invalid guest session")
    return reply.send({ success: true, data: { verified: true, email: payload.email, name: payload.name || "" } })
  } catch {
    reply.clearCookie("guest_interaction_session", { path: "/" })
    return reply.send({ success: true, data: { verified: false } })
  }
}

export const clearGuestInteractionSession = async (_request, reply) => {
  reply.clearCookie("guest_interaction_session", { path: "/" })
  return reply.code(204).send()
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

    if (!googleUserInfo.verified_email) {
      return reply.redirect(`${process.env.FRONTEND_URL}/authentication/sign-in-error`)
    }

    // Trouver ou créer l'utilisateur
    const { user, created } = await findOrCreateGoogleUser(googleUserInfo)
    if (created) {
      try { await notifyAdminsOfNewUser(user) }
      catch (error) { request.log.error(error, "Notification d'inscription Google impossible") }
      const verificationToken = await reply.jwtSign({
        id: user.id, email: user.email, type: "email_verification",
      }, { expiresIn: "24h" })
      await db.insert(emailTokens).values({
        userId: user.id, type: "email_verification", token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      const verificationUrl = `${process.env.FRONTEND_URL}/authentication/verify-email?token=${verificationToken}`
      try { await sendVerificationMail(user, verificationUrl) }
      catch (error) { request.log.error(error, "Le courriel de vérification Google n'a pas pu être envoyé") }
    }


    const mobileFlow = request.cookies.mobile_google_flow
    if (mobileFlow) {
      reply.clearCookie("mobile_google_flow", { path: "/api/auth" })
      const [state, challenge, extra] = mobileFlow.split(".")
      if (!extra && mobileFlowPattern.test(state ?? "") && mobileFlowPattern.test(challenge ?? "")) {
        const code = crypto.randomBytes(32).toString("base64url")
        await db.insert(mobileLoginCodes).values({
          userId: user.id,
          codeHash: mobileCodeHash(code),
          challenge,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        })
        return reply.redirect(`pitayatether://auth?code=${code}&state=${state}`)
      }
    }

    // Créer le JWT de session
    const sessionToken = request.server.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    })

    reply.setCookie("access_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
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
