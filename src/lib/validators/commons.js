import { rules } from "./rules.js"

export const emailRules = [rules.required, rules.email, rules.maxLength(254)]
export const passwordRules = [
  rules.required,
  rules.minLength(8),
  rules.matches(/[A-Z]/, "Must contain uppercase"),
  rules.matches(/[a-z]/, "Must contain lowercase"),
  rules.matches(/[0-9]/, "Must contain at least 1 digit"),
  rules.matches(/[^A-Za-z0-9]/, "Must contain at least 1 special caracter"),
]
export const phoneRules = [
  rules.matches(
    /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
    "Invalid phone format (e.g., +33123456789 or 0123456789)"
  ),
  rules.minLength(10),
  rules.maxLength(20),
]
export const jwtRules = [
  rules.required,
  rules.matches(
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    "Invalid token format"
  ),
]
/** Exemples */
/*
import { createValidator } from "./composer.js"
import { composeValidators } from "./composer.js"

export const passwordValidator = createValidator({
  password: [...passwordRules],
})

export function extendValidator(baseValidator, additionalSchema) {
  return composeValidators(baseValidator, createValidator(additionalSchema))
}
*/
