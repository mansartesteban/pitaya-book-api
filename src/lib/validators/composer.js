import { HttpStatus } from "@lib/HttpStatus.js"
import { error } from "@lib/responses.js"
import { filterObject } from "@lib/utils/Object.js"

// Créer un validator
export function createValidator(schema, options = {}) {
  const { source = "body", target = source, stopOnError = true } = options

  return async (request, reply) => {
    const data = request[source]
    const errors = {}

    // Exécuter le schema de validation
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field]

      for (const rule of rules) {
        const result = await rule(value, data)
        if (result !== true) {
          errors[field] = result
          if (stopOnError) break
        }
      }
    }

    // Si erreurs, stopper
    if (Object.keys(errors).length > 0) {
      console.log("Validation errors:", errors)

      let status
      if (options.source === "params") {
        status = HttpStatus.badRequest(
          "Erreur de validation des paramètres d'url"
        )
      } else {
        status = HttpStatus.badRequest("Erreur de validation du formulaire")
      }
      return error(reply, {
        status: status,
        validation: errors,
      })
    }

    // Stocker les données validées
    if (request.validated === undefined) {
      request.validated = {}
    }
    request.validated[target] = filterObject(data, Object.keys(schema))
  }
}

// Composer des validators
export function composeValidators(...validators) {
  return async (request, reply) => {
    for (const validator of validators) {
      const result = await validator(request, reply)
      if (result !== undefined) {
        return result // Erreur rencontrée, stop
      }
    }
  }
}
