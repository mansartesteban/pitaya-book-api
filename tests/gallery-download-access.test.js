import assert from "node:assert/strict"
import { test } from "node:test"
import { canDownloadGallery, canDownloadPhoto, galleryAccessToken } from "../src/modules/public/gallery/downloadAccess.js"

process.env.JWT_SECRET = "test-gallery-secret"

const gallery = { id: "gallery-1", downloadable: true }

test("public and unlisted galleries can download only when enabled", () => {
  for (const visibility of ["PUBLIC", "UNLISTED"]) {
    assert.equal(canDownloadGallery({ ...gallery, visibility }, {}), true)
    assert.equal(canDownloadGallery({ ...gallery, visibility, downloadable: false }, {}), false)
  }
})

test("private gallery requires both the setting and an unlocked session", () => {
  const privateGallery = { ...gallery, visibility: "PRIVATE" }
  assert.equal(canDownloadGallery(privateGallery, {}), false)
  const request = { cookies: { "gallery_gallery-1": galleryAccessToken(privateGallery.id) } }
  assert.equal(canDownloadGallery(privateGallery, request), true)
  assert.equal(canDownloadGallery(privateGallery, { cookies: { "gallery_gallery-1": "1" } }), false)
  assert.equal(canDownloadGallery({ ...privateGallery, downloadable: false }, request), false)
})

test("hidden galleries cannot be downloaded", () => {
  assert.equal(canDownloadGallery({ ...gallery, visibility: "HIDDEN" }, {}), false)
})

test("individual photos are independent of the gallery ZIP setting", () => {
  for (const visibility of ["PUBLIC", "UNLISTED"]) {
    assert.equal(canDownloadPhoto({ ...gallery, visibility, downloadable: false }, {}), true)
  }

  const privateGallery = { ...gallery, visibility: "PRIVATE", downloadable: false }
  assert.equal(canDownloadPhoto(privateGallery, {}), false)
  assert.equal(canDownloadPhoto(privateGallery, {
    cookies: { "gallery_gallery-1": galleryAccessToken(privateGallery.id) },
  }), true)
  assert.equal(canDownloadPhoto({ ...gallery, visibility: "HIDDEN" }, {}), false)
})
