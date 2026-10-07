import { db } from "../../database/index.js"
import { emailTokens, galleries, users } from "../../database/schema.js"
import { eq } from "drizzle-orm"
import bcrypt from "bcrypt"
import { sendVerificationMail } from "../auth/auth.service.js"

export const getProfile = async (request, reply) => {
  try {
    const [foundAccount] = await db
      .select({
        id: users.id,
        firstname: users.firstname,
        lastname: users.lastname,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, request.user.id))

    if (!foundAccount) {
      return reply.code(404).send({ success: false, message: "User not found" })
    }

    return reply.code(200).send({ success: true, data: foundAccount })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la récupération du profil",
    })
  }
}

export const updateProfile = async (request, reply) => {
  try {
    const [current] = await db.select({ id: users.id, email: users.email, firstname: users.firstname })
      .from(users).where(eq(users.id, request.user.id))
    if (!current) return reply.code(404).send({ success: false, message: "Compte introuvable" })
    const nextEmail = request.validated.body.email.trim().toLowerCase()
    const emailChanged = nextEmail !== current.email.toLowerCase()
    let verificationSent = true
    if (emailChanged) {
      const [used] = await db.select({ id: users.id }).from(users).where(eq(users.email, nextEmail))
      if (used) return reply.code(409).send({ success: false, message: "Cette adresse e-mail est déjà utilisée" })
    }
    const fields = {
      firstname: users.firstname,
      lastname: users.lastname,
      email: users.email,
      phone: users.phone,
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        firstname: request.validated.body.firstname,
        lastname: request.validated.body.lastname,
        email: nextEmail,
        ...(emailChanged ? { emailConfirmed: false } : {}),
        phone: request.validated.body.phone,
      })
      .where(eq(users.id, request.user.id))
      .returning({ ...fields, id: users.id })

    if (!updatedUser) {
      return reply.code(404).send({ success: false, message: "User not found" })
    }

    if (emailChanged) {
      await db.delete(emailTokens).where(eq(emailTokens.userId, current.id))
      const verificationToken = await reply.jwtSign({ id: current.id, email: nextEmail, type: "email_verification" }, { expiresIn: "24h" })
      await db.insert(emailTokens).values({ userId: current.id, type: "email_verification", token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
      try {
        await sendVerificationMail({ firstname: updatedUser.firstname, email: nextEmail },
          `${process.env.FRONTEND_URL}/authentication/verify-email?token=${verificationToken}`)
      } catch (error) { request.log.error(error); verificationSent = false }
    }

    return reply
      .code(200)
      .send({ success: true, data: updatedUser, message: emailChanged
        ? verificationSent ? "Profil mis à jour. Confirmez votre nouvelle adresse e-mail." : "Profil mis à jour. Le courriel n'a pas pu être envoyé ; renvoyez-le depuis votre espace."
        : "Profil mis à jour" })
  } catch (err) {
    request.log.error("Error updating user profile:", err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la mise à jour du profil",
    })
  }
}

export const hasPassword = async (request, reply) => {
  try {
    const [foundAccount] = await db
      .select({ password: users.password, email: users.email })
      .from(users)
      .where(eq(users.id, request.user.id))

    // Handle case where user is not found
    if (!foundAccount) {
      return reply.code(404).send({ success: false, message: "User not found" })
    }

    // Return the user's password (hashed, for security)
    return reply.code(200).send({
      success: true,
      data: {
        hasPassword: !!foundAccount.password,
        email: foundAccount.email,
      },
    })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la vérification du mot de passe",
    })
  }
}

export const updatePassword = async (request, reply) => {
  try {
    const [foundAccount] = await db
      .select({ password: users.password })
      .from(users)
      .where(eq(users.id, request.user.id))

    // Handle case where user is not found
    if (!foundAccount) {
      return reply.code(404).send({ success: false, message: "User not found" })
    }

    // Case when the user has authenticated with oauth2
    if (foundAccount.password) {
      if (
        !bcrypt.compareSync(
          request.validated.body.currentPassword,
          foundAccount.password
        )
      ) {
        return reply.code(400).send({
          success: false,
          validation: { currentPassword: "Current password is incorrect" },
        })
      }
      if (
        bcrypt.compareSync(
          request.validated.body.newPassword,
          foundAccount.password
        )
      ) {
        return reply.code(400).send({
          success: false,
          validation: {
            newPassword: "New password cannot be the same as the old one",
            currentPassword: "New password cannot be the same as the old one",
          },
        })
      }
    }

    const hashedPassword = await bcrypt.hash(
      request.validated.body.newPassword,
      10
    )
    const [updatedAccount] = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, request.user.id))
      .returning()

    // Return a success message
    return reply.code(200).send({
      success: true,
      message: "Password updated successfully",
      data: { updated: !!updatedAccount },
    })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la mise à jour du mot de passe",
    })
  }
}

export const deleteAccount = async (request, reply) => {
  const [account] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, request.user.id))
  if (!account) return reply.code(404).send({ success: false, message: "Compte introuvable" })
  if (["ADMIN", "SUPERADMIN"].includes(account.role)) return reply.code(403).send({ success: false, message: "Compte administrateur non supprimable ici" })
  const [ownedGallery] = await db.select({ id: galleries.id }).from(galleries).where(eq(galleries.ownerUserId, account.id)).limit(1)
  if (ownedGallery) return reply.code(409).send({ success: false, message: "Ce compte possède une galerie" })
  await db.delete(users).where(eq(users.id, account.id))
  reply.clearCookie("access_token", { path: "/" })
  return reply.code(204).send()
}
