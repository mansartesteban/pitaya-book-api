import assert from "node:assert/strict"
import { test } from "node:test"
import { buildArchiveEntries } from "../src/modules/public/gallery/archivePaths.js"

test("archive paths follow the nested gallery hierarchy", () => {
  const galleries = [
    { id: "root", title: "Principal" },
    { id: "a", parentGalleryId: "root", title: "Première série" },
    { id: "b", parentGalleryId: "root", title: "Deuxième série" },
    { id: "nested", parentGalleryId: "a", title: "Sélection" },
  ]
  const photos = [
    { id: "1", galleryId: "a", filename: "portrait", extension: "jpg" },
    { id: "2", galleryId: "b", filename: "groupe", extension: "jpg" },
    { id: "3", galleryId: "nested", filename: "détail", extension: "png" },
  ]

  assert.deepEqual(buildArchiveEntries("root", galleries, photos).map((entry) => entry.name), [
    "Première série/portrait.jpg",
    "Deuxième série/groupe.jpg",
    "Première série/Sélection/détail.png",
  ])
})

test("archive paths prevent traversal and duplicate names", () => {
  const galleries = [
    { id: "root" },
    { id: "a", parentGalleryId: "root", title: "../Événement" },
    { id: "b", parentGalleryId: "root", title: "..\\Événement" },
  ]
  const photos = [
    { galleryId: "a", filename: "../image", extension: "jpg" },
    { galleryId: "a", filename: "../image", extension: "jpg" },
    { galleryId: "b", filename: "image", extension: "jpg" },
  ]
  const names = buildArchiveEntries("root", galleries, photos).map((entry) => entry.name)
  assert.deepEqual(names, [
    "..-Événement/..-image.jpg",
    "..-Événement/..-image (2).jpg",
    "..-Événement (2)/image.jpg",
  ])
  assert.ok(names.every((name) => !name.includes("../")))
})

test("three child galleries keep one hundred photos each", () => {
  const galleries = [
    { id: "root" },
    ...[1, 2, 3].map((number) => ({
      id: `child-${number}`,
      parentGalleryId: "root",
      title: `Dossier ${number}`,
    })),
  ]
  const photos = [1, 2, 3].flatMap((number) =>
    Array.from({ length: 100 }, (_, index) => ({
      galleryId: `child-${number}`,
      filename: `photo-${index + 1}`,
      extension: "jpg",
    }))
  )
  const entries = buildArchiveEntries("root", galleries, photos)

  assert.equal(entries.length, 300)
  for (const number of [1, 2, 3]) {
    assert.equal(entries.filter((entry) => entry.name.startsWith(`Dossier ${number}/`)).length, 100)
  }
})
