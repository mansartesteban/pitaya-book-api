import archiver from "archiver"
import fs from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import { finished } from "node:stream/promises"

export async function writeGalleryArchive(zipPath, entries, openPhoto) {
  await fs.promises.mkdir(path.dirname(zipPath), { recursive: true })

  const output = fs.createWriteStream(zipPath)
  const archive = archiver("zip", { zlib: { level: 0 } })
  const completed = new Promise((resolve, reject) => {
    output.once("close", resolve)
    output.once("error", reject)
    archive.once("error", reject)
  })
  // The archive may fail while another photo is being opened.
  completed.catch(() => {})
  archive.pipe(output)

  try {
    for (const { photo, name } of entries) {
      const body = await openPhoto(photo)
      const source = Readable.fromWeb(body)
      // Archiver does not always forward errors from an appended stream.
      source.on("error", () => {})
      archive.append(source, { name })
      await Promise.race([finished(source), completed])
    }

    await archive.finalize()
    await completed
  } catch (error) {
    archive.abort()
    output.destroy()
    if (!output.closed) await new Promise((resolve) => output.once("close", resolve))
    await fs.promises.rm(zipPath, { force: true })
    throw error
  }
}
