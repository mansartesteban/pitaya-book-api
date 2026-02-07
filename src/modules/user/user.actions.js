import { eq } from "drizzle-orm"
import { db } from "@/database/index.js"
import { error, success } from "@/lib/responses.js"
import { users } from "@db/schema"
import { HttpStatus } from "@/lib/HttpStatus.js"

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
      return error(reply, HttpStatus.notFound("User not found"))
    }

    return success(reply, { ...user, username: user.email })
  } catch (err) {
    request.log.error(err)
    return error(reply, HttpStatus.internalError)
  }
}
