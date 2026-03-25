import { createValidator } from "@lib/validators/composer"
import { rules } from "@lib/validators/rules"

export const getGalleryValidator = createValidator(
  {
    galleryId: [rules.required, rules.isUUID],
  },
  { source: "params" }
)
