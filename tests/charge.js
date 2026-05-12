import http from "k6/http"
import { sleep } from "k6"

export const options = {
  vus: 100, // utilisateurs simultanés
  duration: "1m",
}

let galleryIds = [
  "5fc9d0f2-28da-4948-b392-7e61056a4568",
  "09e66615-f852-4f70-a388-127603792b8d",
  "a3f380a4-db67-4a82-83fc-117360d4b243",
  "022e29d8-324c-4495-baac-604b8bc3f0c9",
  "bc957058-c538-4617-9275-327a4bc4fc07",
  "814d9be7-c333-41b2-918c-d1e8285cb0af",
  "664f9ecc-6b89-4419-a886-578ec74873c7",
  "8843a872-d670-4629-89b9-0c076f427cd9",
  "638f0db6-7747-4ad2-a451-5dabb88b94e1",
  "6dfffcbf-e67a-440c-82bf-965d1c5d855b",
]

const pickGalleryId = () => {
  const index = Math.floor(Math.random() * galleryIds.length)
  return galleryIds[index]
}

export default function () {
  // 1. Page galerie principale
  http.get("https://tonsite.com/api/galeries")
  sleep(Math.random() * 2 + 1)

  // 2. Choix d'une galerie (simulé)
  const galerieId = pickGalleryId()
  http.get(`https://tonsite.com/api/galerie/${galerieId}`)
  sleep(Math.random() * 2 + 1)

  //   // 3. Charger quelques photos (miniatures)
  //   for (let i = 0; i < 5; i++) {
  //     http.get(`https://cdn.tonsite.com/thumbs/photo_${i}.jpg`)
  //   }
  //   sleep(1)

  //   // 4. Ouvrir une photo HD
  //   http.get(`https://cdn.tonsite.com/full/photo_1.jpg`)
  //   sleep(1)

  //   // 5. Carousel (images suivantes)
  //   for (let i = 2; i <= 4; i++) {
  //     http.get(`https://cdn.tonsite.com/full/photo_${i}.jpg`)
  //     sleep(0.5)
  //   }
}
