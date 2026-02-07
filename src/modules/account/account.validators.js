import { createValidator } from "@lib/validators/composer"
import { rules } from "@lib/validators/rules"
import { passwordRules } from "@lib/validators/commons"
import { emailRules, phoneRules } from "../../lib/validators/commons"

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
  clientType: [
    rules.required,
    rules.oneOf(["INDIVIDUAL", "PROFESSIONAL", "ASSOCIATION", "OTHER"]),
  ],
  companyName: [
    rules.minLength(2),
    rules.maxLength(100),
    rules.matches(/^[a-zA-Z0-9À-ÿ\s&'.,()-]+$/, "Invalid company name format"),
  ],
})
