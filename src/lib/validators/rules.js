export const rules = {
  required: (value) => {
    return value !== undefined && value !== null && value !== ""
      ? true
      : "This field is required"
  },

  isString: (value) => {
    if (!value) return true
    return typeof value === "string" ? true : "Must be a string"
  },

  isNumber: (value) => {
    if (!value && value !== 0) return true
    return !isNaN(Number(value)) && value !== ""
      ? true
      : "Must be a valid number"
  },

  isInteger: (value) => {
    if (!value && value !== 0) return true
    return Number.isInteger(Number(value)) && value !== ""
      ? true
      : "Must be an integer"
  },

  isBoolean: (value) => {
    if (value === undefined || value === null) return true
    return [true, false, "true", "false", "1", "0", 1, 0].includes(value)
      ? true
      : "Must be a boolean"
  },

  isDate: (value) => {
    if (!value) return true
    const date = new Date(value)
    return !isNaN(date.getTime()) ? true : "Must be a valid date"
  },

  isPositive: (value) => {
    if (!value && value !== 0) return true
    return Number(value) > 0 ? true : "Must be a positive number"
  },

  isNegative: (value) => {
    if (!value && value !== 0) return true
    return Number(value) < 0 ? true : "Must be a negative number"
  },

  isUUID: (value) => {
    if (!value) return true
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
      ? true
      : "Must be a valid UUID"
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

  // Validation de tableau
  array: (value) => {
    if (!value) return true
    return Array.isArray(value) ? true : "Must be an array"
  },

  arrayOf: (type) => (value) => {
    if (!value) return true
    if (!Array.isArray(value)) return "Must be an array"

    // Mapping des constructeurs vers les validators
    const typeValidators = new Map([
      [String, (v) => typeof v === "string"],
      [Number, (v) => typeof v === "number" && !isNaN(v)],
      [Boolean, (v) => typeof v === "boolean"],
      [Object, (v) => typeof v === "object" && v !== null && !Array.isArray(v)],
      [Array, (v) => Array.isArray(v)],
      [Date, (v) => v instanceof Date && !isNaN(v.getTime())],
    ])

    // Support aussi des strings pour rétrocompatibilité et types custom
    const stringValidators = {
      string: (v) => typeof v === "string",
      number: (v) => typeof v === "number" && !isNaN(v),
      boolean: (v) => typeof v === "boolean",
      object: (v) => typeof v === "object" && v !== null && !Array.isArray(v),
      array: (v) => Array.isArray(v),
      date: (v) => v instanceof Date && !isNaN(v.getTime()),
      uuid: (v) =>
        typeof v === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          v
        ),
      email: (v) =>
        typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      url: (v) => {
        try {
          new URL(v)
          return true
        } catch {
          return false
        }
      },
    }

    let validator
    let typeName

    // Si c'est un constructeur
    if (typeValidators.has(type)) {
      validator = typeValidators.get(type)
      typeName = type.name.toLowerCase()
    }
    // Si c'est une string
    else if (typeof type === "string" && stringValidators[type]) {
      validator = stringValidators[type]
      typeName = type
    }
    // Type inconnu
    else {
      return `Unknown type: ${type}`
    }

    const invalidIndex = value.findIndex((item) => !validator(item))
    if (invalidIndex !== -1) {
      return `Item at index ${invalidIndex} is not a valid ${typeName}`
    }

    return true
  },

  arrayMinLength: (min) => (value) => {
    if (!value) return true
    if (!Array.isArray(value)) return "Must be an array"
    return value.length >= min
      ? true
      : `Array must contain at least ${min} item${min > 1 ? "s" : ""}`
  },

  arrayMaxLength: (max) => (value) => {
    if (!value) return true
    if (!Array.isArray(value)) return "Must be an array"
    return value.length <= max
      ? true
      : `Array must contain at most ${max} item${max > 1 ? "s" : ""}`
  },

  arrayUnique: (value) => {
    if (!value) return true
    if (!Array.isArray(value)) return "Must be an array"
    const unique = new Set(value)
    return unique.size === value.length
      ? true
      : "Array must contain unique values"
  },

  arrayNotEmpty: (value) => {
    if (!value) return "Array is required"
    if (!Array.isArray(value)) return "Must be an array"
    return value.length > 0 ? true : "Array cannot be empty"
  },

  // Validation de chaque élément du tableau
  arrayEach:
    (...itemRules) =>
    async (value, data) => {
      if (!value) return true
      if (!Array.isArray(value)) return "Must be an array"

      for (let i = 0; i < value.length; i++) {
        for (const rule of itemRules) {
          const result = await rule(value[i], data)
          if (result !== true) {
            return `Item at index ${i}: ${result}`
          }
        }
      }

      return true
    },

  // Validation avec schéma complexe pour chaque élément
  arrayOfObjects: (schema) => async (value, data) => {
    if (!value) return true
    if (!Array.isArray(value)) return "Must be an array"

    for (let i = 0; i < value.length; i++) {
      const item = value[i]

      if (typeof item !== "object" || item === null) {
        return `Item at index ${i} must be an object`
      }

      // Valider chaque champ de l'objet
      for (const [field, fieldRules] of Object.entries(schema)) {
        for (const rule of fieldRules) {
          const result = await rule(item[field], item)
          if (result !== true) {
            return `Item at index ${i}, field '${field}': ${result}`
          }
        }
      }
    }

    return true
  },

  // Valider que le tableau contient certaines valeurs
  arrayContains: (requiredValue) => (value) => {
    if (!value) return true
    if (!Array.isArray(value)) return "Must be an array"
    return value.includes(requiredValue)
      ? true
      : `Array must contain '${requiredValue}'`
  },

  // Valider que le tableau ne contient que des valeurs autorisées
  arrayOnlyContains: (allowedValues) => (value) => {
    if (!value) return true
    if (!Array.isArray(value)) return "Must be an array"

    const invalid = value.filter((item) => !allowedValues.includes(item))
    if (invalid.length > 0) {
      return `Array contains invalid values: ${invalid.join(", ")}. Allowed: ${allowedValues.join(", ")}`
    }

    return true
  },
}
