import {
  composeValidators,
  createValidator,
} from "../../lib/validators/composer"
import { rules } from "../../lib/validators/rules"

export const createCompanyValidator = createValidator({
  name: [rules.required, rules.isString],
  legalName: [rules.isString],
  location: [],
  vatNumber: [rules.isNumber],
  siret: [
    rules.custom((siret) => {
      if (!/^\d{14}$/.test(siret)) {
        return "Le numéro de Siret renseigné ne respecte pas le format attendu : 14 chiffres"
      }

      let sum = 0

      for (let i = 0; i < 14; i++) {
        let digit = parseInt(siret[13 - i], 10) // on part de la droite

        if (i % 2 === 1) {
          // on double un chiffre sur deux
          digit *= 2
          if (digit > 9) digit -= 9
        }

        sum += digit
      }

      return sum % 10 === 0 ? true : "Le numéro de Siret renseigné est invalide"
    }),
  ],
})

export const updateCompanyValidator = composeValidators(
  createCompanyValidator,
  createValidator(
    {
      companyId: [rules.required, rules.isUUID],
    },
    { source: "params" }
  )
)

export const deleteCompanyValidator = createValidator(
  {
    companyId: [rules.required, rules.isUUID],
  },
  { source: "params" }
)

export const getCompanyValidator = createValidator(
  {
    companyId: [rules.required, rules.isUUID],
  },
  { source: "params" }
)
