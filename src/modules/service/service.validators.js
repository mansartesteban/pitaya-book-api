import {
  createValidator,
  composeValidators,
} from "../../lib/validators/composer.js"
import { rules } from "../../lib/validators/rules.js"

export const createServiceValidator = createValidator({
  description: [],
  location: [],
  title: [rules.required],
  price: [rules.isNumber],
  company: [rules.arrayOf("uuid")],
})
export const getOneServiceValidator = createValidator(
  {
    id: [rules.isNumber],
  },
  { source: "params" }
)

export const updateServiceSchema = composeValidators(
  createValidator(
    {
      description: [],
      location: [],
      title: [rules.isString],
      price: [rules.isNumber],
      company: [rules.arrayOf("uuid")],
    },
    { source: "body" }
  ),
  createValidator(
    {
      id: [rules.isUUID],
    },
    { source: "params" }
  )
)

export const uploadFileServiceValidator = createValidator(
  {
    serviceId: [rules.required, rules.isNumber],
  },
  { source: "params" }
)

export const listFileServiceValidator = createValidator(
  {
    serviceId: [rules.required, rules.isNumber],
  },
  { source: "params" }
)

export const getFileValidator = createValidator(
  {
    serviceId: [rules.required, rules.isNumber],
    fileId: [rules.required, rules.isUUID],
  },
  {
    source: "params",
  }
)
export const deleteFileValidator = createValidator(
  {
    serviceId: [rules.required, rules.isNumber],
    fileId: [rules.required, rules.isUUID],
  },
  {
    source: "params",
  }
)
