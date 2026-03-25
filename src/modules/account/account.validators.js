import { createValidator } from "../../lib/validators/composer.js"
import { rules } from "../../lib/validators/rules.js"
import { passwordRules } from "../../lib/validators/commons.js"
import { emailRules, phoneRules } from "../../lib/validators/commons.js"

export const updatePasswordValidator = createValidator({
  currentPassword: [rules.required],
  newPassword: [
    ...passwordRules,
    rules.custom((value, data) => {
      return value !== data.currentPassword
        ? true
        : "New password must be different"
    }),
  ],
  confirmPassword: [
    ...passwordRules,

    rules.custom((value, data) => {
      return value === data.newPassword
        ? true
        : "New password and confirmation are not identical"
    }),
  ],
})

export const updateProfileValidator = createValidator({
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
})
