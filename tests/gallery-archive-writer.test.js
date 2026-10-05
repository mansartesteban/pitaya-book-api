import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { writeGalleryArchive } from "../src/modules/public/gallery/archiveWriter.js"

const photo = { id: "photo-1" }

test("writes a photo into the archive", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gallery-zip-"))
  const zipPath = path.join(directory, "gallery.zip")
  try {
    await writeGalleryArchive(zipPath, [{ photo, name: "Album/photo.jpg" }], async () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
      })
    )
    assert.ok((await fs.stat(zipPath)).size > 0)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("a failed photo stream rejects and removes the incomplete archive", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gallery-zip-"))
  const zipPath = path.join(directory, "gallery.zip")
  try {
    await assert.rejects(
      writeGalleryArchive(zipPath, [{ photo, name: "photo.jpg" }], async () =>
        new ReadableStream({
          start(controller) {
            controller.error(new Error("Connection timed out"))
          },
        })
      ),
      /Connection timed out/
    )
    await assert.rejects(fs.stat(zipPath), { code: "ENOENT" })
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
