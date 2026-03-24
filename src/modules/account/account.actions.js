import { db } from "@db"
import { users } from "@db/schema"
import { error, success } from "@lib/responses"
import { eq } from "drizzle-orm"
import { HttpStatus } from "@/lib/httpStatus"
import bcrypt from "bcrypt"

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
      return error(reply, HttpStatus.notFound("User not found"))
    }

    return success(reply, { data: foundAccount })
  } catch (err) {
    console.error("err", err)

    request.log.error(err)
    return error(
      reply,
      HttpStatus.internalError("Erreur lors de la récupération du profil")
    )
  }
}

export const updateProfile = async (request, reply) => {
  try {
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
        email: request.validated.body.email,
        phone: request.validated.body.phone,
      })
      .where(eq(users.id, request.user.id))
      .returning({ ...fields, id: users.id })

    if (updatedUser.length === 0) {
      return error(reply, HttpStatus.notFound("User not found"))
    }

    return success(reply, { data: updatedUser, message: "Profil mis à jour" })
  } catch (err) {
    console.error("Error updating user profile:", err)
    return error(
      reply,
      HttpStatus.internalError("Erreur lors de la mise à jour du profil")
    )
  }
}

export const hasPassword = async (request, reply) => {
  try {
    const [foundAccount] = await db
      .select({ password: users.password })
      .from(users)
      .where(eq(users.id, request.user.id))

    // Handle case where user is not found
    if (!foundAccount) {
      return error(reply, HttpStatus.notFound("User not found"))
    }

    // Return the user's password (hashed, for security)
    return success(reply, {
      data: {
        hasPassword: !!foundAccount.password,
        email: foundAccount.email,
      },
    })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return error(
      reply,
      HttpStatus.internalError("Erreur lors de la vérification du mot de passe")
    )
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
      return error(reply, HttpStatus.notFound("User not found"))
    }

    // Case when the user has authenticated with oauth2
    if (foundAccount.password) {
      if (
        !bcrypt.compareSync(
          request.validated.body.currentPassword,
          foundAccount.password
        )
      ) {
        return error(reply, {
          ...HttpStatus.badRequest(),
          validation: { currentPassword: "Current password is incorrect" },
        })
      }
      if (
        bcrypt.compareSync(
          request.validated.body.newPassword,
          foundAccount.password
        )
      ) {
        return error(reply, HttpStatus.badRequest(), {
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
    return success(reply, {
      message: "Password updated successfully",
      data: { user: updatedAccount },
    })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return error(
      reply,
      HttpStatus.internalError("Erreur lors de la mise à jour du mot de passe")
    )
  }
}
