import {
  composeValidators,
  createValidator,
} from "../../../lib/validators/composer.js"
import { rules } from "../../../lib/validators/rules.js"

export const getGalleryValidator = createValidator(
  {
    galleryId: [rules.required, rules.isString, rules.maxLength(240), rules.matches(/^[a-zA-Z0-9-]+$/)],
  },
  { source: "params" }
)
export const getPhotoDownloadValidator = createValidator(
  {
    galleryId: [rules.required, rules.isUUID],
    photoId: [rules.required, rules.isUUID],
  },
  { source: "params" }
)
export const getPrivateGalleryValidator = composeValidators(
  createValidator(
    {
      galleryId: [rules.required, rules.isUUID],
    },
    { source: "params" }
  ),
  createValidator(
    { password: [rules.required, rules.isString] },
    { source: "body" }
  )
)
