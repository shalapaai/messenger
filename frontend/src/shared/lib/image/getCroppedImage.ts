export type CroppedAreaPixels = {
  x: number
  y: number
  width: number
  height: number
}

export async function getCroppedImage(
  imageSrc: string,
  croppedAreaPixels: CroppedAreaPixels,
  fileName: string,
  fileType: string,
): Promise<File> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Не удалось подготовить изображение')
  }

  canvas.width = croppedAreaPixels.width
  canvas.height = croppedAreaPixels.height

  context.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
  )

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Не удалось обрезать изображение'))
        return
      }

      resolve(result)
    }, fileType)
  })

  return new File([blob], fileName, { type: fileType })
}

function createImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () =>
      reject(new Error('Не удалось загрузить изображение')),
    )

    image.crossOrigin = 'anonymous'
    image.src = src
  })
}
