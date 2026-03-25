import { postContact } from "./main.actions.js"
import { contactValidator } from "./main.validators.js"

export default function mainRoutes(fastify) {
  fastify.post(
    "/contact",
    {
      preHandler: [contactValidator],
    },
    postContact
  )
}
