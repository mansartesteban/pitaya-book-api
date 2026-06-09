import {
  createValidator,
  composeValidators,
  runRules,
} from "../../lib/validators/composer.js"
import { rules } from "../../lib/validators/rules.js"
import { passwordRules } from "../../lib/validators/commons.js"

export const getOneGalleryValidator = createValidator(
  {
    galleryId: [rules.required, rules.isUUID],
  },
  { source: "params" }
)
export const createGalleryValidator = createValidator({
  title: [
    rules.required,
    rules.isString,
    rules.minLength(2),
    rules.maxLength(128),
  ],
  visibility: [rules.required, rules.isNumber],
  description: [rules.isString],
})
export const updateGalleryValidator = composeValidators(
  createValidator({
    title: [
      rules.required,
      rules.isString,
      rules.minLength(2),
      rules.maxLength(128),
    ],
    name: [rules.isString],
    visibility: [rules.required, rules.isNumber],
    description: [rules.isString],
    parentGalleryId: [rules.isUUID],
    password: [
      rules.custom((value, { visibility }) => {
        if (visibility === 0) {
          return runRules(value, { visibility }, passwordRules)
        }
        return true
      }),
    ],
  }),
  createValidator(
    {
      galleryId: [rules.required, rules.isUUID],
    },
    { source: "params" }
  )
)
export const addParentGalleryValidator = composeValidators(
  createValidator({
    parentGalleryId: [rules.isUUID],
  }),
  createValidator(
    {
      galleryId: [rules.required, rules.isUUID],
    },
    { source: "params" }
  )
)
export const removeParentGalleryValidator = composeValidators(
  createValidator(
    {
      galleryId: [rules.required, rules.isUUID],
    },
    { source: "params" }
  )
)
export const deleteGalleryValidator = createValidator(
  {
    galleryId: [rules.required, rules.isUUID],
  },
  { source: "params" }
)

export const uploadPhotoValidator = createValidator(
  {
    galleryId: [rules.required, rules.isUUID],
  },
  { source: "params" }
)
export const deletePhotoValidator = createValidator(
  {
    galleryId: [rules.required, rules.isUUID],
    photoId: [rules.required, rules.isUUID],
  },
  { source: "params" }
)
export const uploadPhotoCoverValidator = createValidator(
  {
    galleryId: [rules.required, rules.isUUID],
  },
  { source: "params" }
)
export const deletePhotoCoverValidator = createValidator(
  {
    galleryId: [rules.required, rules.isUUID],
  },
  { source: "params" }
)

export const deleteMultiplePhotosValidator = composeValidators(
  createValidator({
    photosToDelete: [rules.required, rules.arrayOf("uuid")],
  }),
  createValidator(
    {
      galleryId: [rules.required, rules.isUUID],
    },
    { source: "params" }
  )
)
export const updatePhotoValidator = composeValidators(
  createValidator({
    filename: [rules.isString],
    galleryId: [rules.isUUID],
  }),
  createValidator(
    {
      galleryId: [rules.required, rules.isUUID],
      photoId: [rules.required, rules.isUUID],
    },
    { source: "params" }
  )
)
export const downloadPhotoValidator = createValidator(
  {
    galleryId: [rules.required, rules.isUUID],
    photoId: [rules.required, rules.isUUID],
  },
  { source: "params" }
)
export const downloadMultiplePhotosValidator = composeValidators(
  createValidator({
    photosIds: [rules.required, rules.arrayOf("uuid")],
  }),
  createValidator(
    {
      galleryId: [rules.required, rules.isUUID],
    },
    { source: "params" }
  )
)
