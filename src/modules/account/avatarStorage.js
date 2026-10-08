import * as BunnyStorageSDK from "@bunny.net/storage-sdk"
import crypto from "node:crypto"

const folder = "/profile-pictures"

function storageZone() {
  if (!process.env.BUNNY_STORAGE_ZONE || !process.env.BUNNY_FTP_PASSWORD) {
    throw new Error("Bunny storage is not configured")
  }
  return BunnyStorageSDK.zone.connect_with_accesskey(
    BunnyStorageSDK.regions.StorageRegion.Falkenstein,
    process.env.BUNNY_STORAGE_ZONE,
    process.env.BUNNY_FTP_PASSWORD
  )
}

export function avatarPath(userId) {
  return `${folder}/${userId}/${crypto.randomUUID()}.webp`
}

export function avatarUrl(path) {
  return `${process.env.API_URL?.replace(/\/$/, "") || ""}/api/account/avatar-file${path.slice(folder.length)}`
}

export function avatarPathFromUrl(url) {
  const match = url?.match(/\/api\/account\/avatar-file(\/[^/]+\/[^/]+\.webp)$/)
  return match ? `${folder}${match[1]}` : null
}

export async function uploadAvatar(path, buffer) {
  const result = await BunnyStorageSDK.file.upload(storageZone(), path, buffer)
  if (!result) throw new Error("Bunny avatar upload failed")
}

export async function downloadAvatar(path) {
  return BunnyStorageSDK.file.download(storageZone(), path)
}

export async function removeAvatar(path) {
  return BunnyStorageSDK.file.remove(storageZone(), path)
}
