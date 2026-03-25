import { postContact } from "./main.actions"
import { contactValidator } from "./main.validators"

export default function mainRoutes(fastify) {
  fastify.post(
    "/contact",
    {
      preHandler: [contactValidator],
    },
    postContact
  )
}
