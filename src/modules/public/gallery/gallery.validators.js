import { createValidator } from "../../../lib/validators/composer.js"
import { rules } from "../../../lib/validators/rules.js"

export const getGalleryValidator = createValidator(
  {
    galleryId: [rules.required, rules.isUUID],
  },
  { source: "params" }
)
