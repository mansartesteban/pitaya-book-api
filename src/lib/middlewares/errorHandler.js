// Hook d'erreur global Fastify
export function registerErrorHandler(fastify) {
  fastify.setErrorHandler((error, request, reply) => {
    request.log.error(error)

    // Erreurs Drizzle
    if (error.code === "23505") {
      // Unique constraint
      return reply.status(409).send({
        success: false,
        error: { message: "Resource already exists" },
      })
    }

    // Erreurs de validation (si pas catchées par validators)
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: { message: "Validation failed", details: error.validation },
      })
    }

    // Erreur générique
    return reply.status(error.statusCode || 500).send({
      success: false,
      error: { message: error.message || "Internal server error" },
    })
  })
}
