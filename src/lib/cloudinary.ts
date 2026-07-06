import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export async function uploadImageToCloudinary(
  fileBuffer: Buffer,
  folder: string,
  publicId?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error)
          return
        }
        if (!result?.secure_url) {
          reject(new Error('Falha ao obter URL da imagem'))
          return
        }
        resolve(result.secure_url)
      }
    )

    uploadStream.end(fileBuffer)
  })
}

export async function uploadAttachmentToCloudinary(
  fileBuffer: Buffer,
  folder: string,
  publicId?: string
): Promise<{ url: string; mimeType?: string; bytes?: number }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          reject(error)
          return
        }
        if (!result?.secure_url) {
          reject(new Error('Falha ao obter URL do anexo'))
          return
        }
        resolve({
          url: result.secure_url,
          mimeType: result.resource_type === 'image' ? `image/${result.format}` : result.format,
          bytes: result.bytes,
        })
      }
    )

    uploadStream.end(fileBuffer)
  })
}

export { cloudinary }
