import { Router } from 'express'
import multer from 'multer'
import { uploadImageToCloudinary } from '../lib/cloudinary'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Apenas imagens são permitidas'))
      return
    }
    cb(null, true)
  },
})

router.use(authenticate)
router.use(extractTenant)

router.post('/image', upload.single('image'), async (req, res, next) => {
  try {
    const tenant = req.tenant!

    if (!req.file) {
      res.status(400).json({ error: 'Nenhuma imagem enviada' })
      return
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      res.status(500).json({ error: 'Cloudinary não configurado' })
      return
    }

    const folder = `menufacil/${tenant.id}`
    const publicId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`

    const url = await uploadImageToCloudinary(req.file.buffer, folder, publicId)

    res.json({ url })
  } catch (err) {
    next(err)
  }
})

export default router
