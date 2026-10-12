import { Readable } from 'node:stream'
import sharp from 'sharp'
import { signPhotoUrl } from '../../../lib/utils/Photo.js'

const apiBase = String(process.env.API_URL || '').replace(/\/$/, '')

export function previewUrl(photo, width) {
  return `${apiBase}/api/public/gallery/${photo.galleryId}/photos/${photo.id}/preview?width=${width}`
}

export function publicPhotoUrls(photo) {
  return {
    300: previewUrl(photo, 300),
    600: previewUrl(photo, 600),
    preview: previewUrl(photo, 1600),
  }
}

export function managerPreviewUrl(photo, width) {
  return `${apiBase}/api/member/galleries/${photo.galleryId}/photos/${photo.id}/preview?width=${width}`
}

export async function sendPhotoPreview(photo, width, request, reply) {
  try {
    const response = await fetch(signPhotoUrl(photo, true, width === 1600 ? null : width))
    if (!response.ok || !response.body) throw new Error(`Photo CDN: ${response.status}`)
    reply.header('Cache-Control', 'private, no-store')
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Content-Disposition', 'inline')
    if (width === 1600) {
      const preview = Readable.fromWeb(response.body).pipe(
        sharp().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
      )
      return reply.type('image/webp').send(preview)
    }
    return reply.type(response.headers.get('content-type') || 'image/jpeg')
      .send(Readable.fromWeb(response.body))
  } catch (error) {
    request.log.error(error, 'Aperçu photo indisponible')
    return reply.code(502).send({ success: false, message: 'Photo indisponible' })
  }
}
