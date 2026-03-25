import fs from "fs/promises"
import { createWriteStream } from "fs"
import path from "path"
import { pipeline } from "stream/promises"
import crypto from "crypto"
import { db } from "../database/index.js"
import { documents } from "../database/schemas/document.schema.js"
import { eq } from "drizzle-orm"

export class DocumentManager {
  constructor(options = {}) {
    this.uploadDir = options.uploadDir || path.join(process.cwd(), "uploads")
    this.maxSize = options.maxSize || 10 * 1024 * 1024 // 10MB par défaut
    this.allowedTypes = options.allowedTypes || [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    ]
  }

  /**
   * Upload et enregistre un fichier
   */
  async upload(file, options = {}) {
    const { serviceId = null, category = "OTHER", folder = null } = options

    // Validation
    this.validate(file)

    // Préparer les infos
    const fileInfo = this.extractFileInfo(file)
    const storedName = this.generateStoredName(
      fileInfo.filename,
      fileInfo.extension
    )
    const targetFolder = this.resolveFolder(category, folder)
    const fullPath = path.join(this.uploadDir, targetFolder, storedName)

    // Créer le dossier si nécessaire
    await fs.mkdir(path.dirname(fullPath), { recursive: true })

    // Sauvegarder le fichier
    await pipeline(file.file, createWriteStream(fullPath))

    const stats = await fs.stat(fullPath)
    const fileSize = stats.size

    // Enregistrer en DB
    const [document] = await db
      .insert(documents)
      .values({
        serviceId,
        filename: fileInfo.filename,
        storedName,
        mimetype: fileInfo.mimetype,
        extension: fileInfo.extension,
        type: fileInfo.type,
        category,
        size: fileSize,
        folder: targetFolder,
        storageProvider: "local",
        url: this.generateUrl(targetFolder, storedName),
        path: fullPath,
      })
      .returning()

    return document
  }

  /**
   * Récupérer les infos d'un document par ID
   */
  async getById(id) {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))

    if (!document) {
      throw new Error(`Document ${id} not found`)
    }

    return {
      ...document,
    }
  }

  /**
   * Supprimer un document (DB + disque)
   */
  async delete(id, options = {}) {
    const { softDelete = false } = options

    const document = await this.getById(id)

    if (softDelete) {
      // Soft delete (garder le fichier)
      await db
        .update(documents)
        .set({ deletedAt: new Date() })
        .where(eq(documents.id, id))
    } else {
      // Hard delete
      try {
        await fs.unlink(document.path)
      } catch (error) {
        console.error(`Failed to delete file ${document.path}:`, error)
      }

      await db.delete(documents).where(eq(documents.id, id))
    }

    return document
  }

  /**
   * Valider le fichier
   */
  validate(file) {
    if (!file) {
      throw new Error("No file provided")
    }

    if (!this.allowedTypes.includes(file.mimetype)) {
      throw new Error(
        `File type ${file.mimetype} not allowed. Allowed: ${this.allowedTypes.join(", ")}`
      )
    }

    // Note: file.file.bytesRead donne la taille après lecture
    // Pour vérifier avant, il faudrait utiliser un stream transform
  }

  /**
   * Extraire les infos du fichier
   */
  extractFileInfo(file) {
    const extension = path.extname(file.filename).toLowerCase()
    const type = this.detectType(file.mimetype, extension)

    return {
      filename: file.filename,
      mimetype: file.mimetype,
      extension,
      type,
      size: 0, // Sera calculé après upload
    }
  }

  /**
   * Détecter le type de document
   */
  detectType(mimetype, extension) {
    if (mimetype.startsWith("image/")) return "IMAGE"
    if (mimetype === "application/pdf") return "PDF"
    if (mimetype.startsWith("video/")) return "VIDEO"
    if (
      mimetype.includes("document") ||
      mimetype.includes("word") ||
      mimetype.includes("excel")
    ) {
      return "DOCUMENT"
    }
    return "OTHER"
  }

  /**
   * Générer un nom de fichier unique
   */
  generateStoredName(originalName, extension) {
    const hash = crypto.randomBytes(16).toString("hex")
    const timestamp = Date.now()
    const sanitized = originalName
      .replace(extension, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .substring(0, 50)

    return `${timestamp}-${hash}-${sanitized}${extension}`
  }

  /**
   * Résoudre le dossier de destination
   */
  resolveFolder(customFolder, category) {
    if (customFolder) return customFolder

    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, "0")

    return `${category.toLowerCase()}/${year}/${month}`
  }

  /**
   * Générer l'URL d'accès
   */
  generateUrl(folder, filename) {
    return `/uploads/${folder}/${filename}`
  }

  /**
   * Obtenir les stats de taille
   */
  async getStats(serviceId = null) {
    let query = db.select().from(documents)

    if (serviceId) {
      query = query.where(eq(documents.serviceId, serviceId))
    }

    const docs = await query

    return {
      totalFiles: docs.length,
      totalSize: docs.reduce((sum, doc) => sum + doc.size, 0),
      byType: docs.reduce((acc, doc) => {
        acc[doc.type] = (acc[doc.type] || 0) + 1
        return acc
      }, {}),
      byCategory: docs.reduce((acc, doc) => {
        acc[doc.category] = (acc[doc.category] || 0) + 1
        return acc
      }, {}),
    }
  }
}

// Instance singleton
export const documentManager = new DocumentManager()
