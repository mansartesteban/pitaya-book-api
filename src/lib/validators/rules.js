export const rules = {
  required: (value) => {
    return value !== undefined && value !== null && value !== ""
      ? true
      : "This field is required"
  },

  email: (value) => {
    if (!value) return true // Si pas required, skip
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? true
      : "Invalid email format"
  },

  minLength: (min) => (value) => {
    if (!value) return true
    return value.length >= min ? true : `Minimum ${min} characters required`
  },

  maxLength: (max) => (value) => {
    if (!value) return true
    return value.length <= max ? true : `Maximum ${max} characters allowed`
  },

  matches:
    (regex, message = "Invalid format") =>
    (value) => {
      if (!value) return true
      return regex.test(value) ? true : message
    },

  oneOf: (values) => (value) => {
    return values.includes(value)
      ? true
      : `Must be one of: ${values.join(", ")}`
  },

  equals: (comparedValue) => (value) => {
    return (
      value === comparedValue ||
      `Value '${value}' does not match '${comparedValue}`
    )
  },

  greaterThan:
    (comparedValue, strict = false) =>
    (value) => {
      if (strict) {
        return (
          value > comparedValue ||
          `Value has to be greather than ${comparedValue}`
        )
      } else {
        return (
          value >= comparedValue ||
          `Value has to be greather than ${comparedValue}`
        )
      }
    },

  lessThan:
    (comparedValue, strict = false) =>
    (value) => {
      if (strict) {
        return (
          value < comparedValue || `Value has to be less than ${comparedValue}`
        )
      } else {
        return (
          value <= comparedValue || `Value has to be less than ${comparedValue}`
        )
      }
    },

  custom: (fn) => fn,
}
