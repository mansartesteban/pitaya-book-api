import { createValidator } from "@lib/validators/composer"
import { emailRules, passwordRules, jwtRules } from "@lib/validators/commons"
import { rules } from "@lib/validators/rules"

export const signInFormValidator = createValidator({
  email: emailRules,
  password: passwordRules,
})

export const signUpFormValidator = createValidator({
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
  password: passwordRules,
  confirmPassword: [
    ...passwordRules,
    rules.custom((value, data) => {
      return value === data.password
        ? true
        : "Password confirmation is not the same as password"
    }),
  ],
})

export const forgotPasswordValidator = createValidator({
  email: emailRules,
})

export const resetPasswordValidator = createValidator({
  token: jwtRules,
  password: passwordRules,
  confirmPassword: [
    ...passwordRules,
    rules.custom((value, data) => {
      return value === data.password
        ? true
        : "Password confirmation is not the same as password"
    }),
  ],
})
