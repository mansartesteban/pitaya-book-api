import { eq } from "drizzle-orm"
import { db } from "../../database/index.js"
import { users } from "../../database/schema.js"

export const getUser = async (request, reply) => {
  try {
    const [user] = await db
      .select({
        role: users.role,
        firstname: users.firstname,
        lastname: users.lastname,
        email: users.email,
        emailConfirmed: users.emailConfirmed,
      })
      .from(users)
      .where(eq(users.id, request.user.id))

    if (!user) {
      return reply.code(404).send({ success: false, message: "User not found" })
    }

    return reply
      .code(200)
      .send({ success: true, data: { ...user, username: user.email } })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la récupération de l'utilisateur",
    })
  }
}

export const getAllUsers = async (request, reply) => {
  try {
    const userList = await db
      .select({
        role: users.role,
        firstname: users.firstname,
        lastname: users.lastname,
        email: users.email,
        emailConfirmed: users.emailConfirmed,
      })
      .from(users)

    reply.status(200).send({ success: true, data: userList })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la récupération de l'utilisateur",
    })
  }
}
