import { createValidator, composeValidators } from "@lib/validators/composer"
import { rules } from "@lib/validators/rules"
import { emailRules, phoneRules } from "../../lib/validators/commons"

export const contactValidator = createValidator({
  firstname: [
    rules.required,
    rules.minLength(2),
    rules.maxLength(50),
    rules.matches(
      /^[a-zA-ZÀ-ÿ\s'-]+$/,
      "Only letters, spaces, hyphens and apostrophes allowed"
    ),
  ],
  lastname: [
    rules.required,
    rules.minLength(2),
    rules.maxLength(50),
    rules.matches(
      /^[a-zA-ZÀ-ÿ\s'-]+$/,
      "Only letters, spaces, hyphens and apostrophes allowed"
    ),
  ],
  email: emailRules,
  phone: phoneRules,
  object: [
    rules.required,
    rules.array,
    rules.custom((value, data) => {
      return value[0].value > -1 && value[0].label ? true : "L'objet est requis"
    }),
  ],
  content: [rules.required],
})
