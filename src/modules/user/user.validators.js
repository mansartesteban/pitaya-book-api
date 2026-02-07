export const updateProfileValidator = createValidator({
  username: [rules.minLength(3), rules.maxLength(50)],
  bio: [rules.maxLength(500)],
  avatar: [
    rules.custom((value) => {
      if (value && !value.startsWith("http")) {
        return "Avatar must be a valid URL"
      }
      return true
    }),
  ],
})
