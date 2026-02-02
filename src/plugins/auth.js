import fp from "fastify-plugin"

export default fp(async (fastify) => {
  fastify.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })
})
