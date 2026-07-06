import { Router } from 'express'
import authRoutes from './auth'
import tenantRoutes from './tenants'
import publicRoutes from './public'
import menuRoutes from './menu'
import storeRoutes from './store'
import orderRoutes from './orders'
import inventoryRoutes from './inventory'
import supportRoutes from './support'
import adminRoutes from './admin'
import whatsappRoutes from './whatsapp'
import paymentRoutes from './payments'
import invoiceRoutes from './invoices'
import uploadRoutes from './upload'
import mpRoutes from './mp'
import customerRoutes from './customers'
import reportRoutes from './reports'
import deliveryZoneRoutes from './deliveryZones'
import eventRoutes from './events'
import printerRoutes from './printer'
import discountRoutes from './discounts'
import pushRoutes from './push'
import teamRoutes from './team'
import testimonialRoutes from './testimonials'

const router = Router()

router.use('/auth', authRoutes)
router.use('/tenants', tenantRoutes)
router.use('/loja', publicRoutes)
router.use('/menu', menuRoutes)
router.use('/store', storeRoutes)
router.use('/orders', orderRoutes)
router.use('/inventory', inventoryRoutes)
router.use('/support', supportRoutes)
router.use('/admin', adminRoutes)
router.use('/whatsapp', whatsappRoutes)
router.use('/payments', paymentRoutes)
router.use('/invoices', invoiceRoutes)
router.use('/upload', uploadRoutes)
router.use('/mp', mpRoutes)
router.use('/customers', customerRoutes)
router.use('/reports', reportRoutes)
router.use('/delivery-zones', deliveryZoneRoutes)
router.use('/events', eventRoutes)
router.use('/printer', printerRoutes)
router.use('/discounts', discountRoutes)
router.use('/push', pushRoutes)
router.use('/team', teamRoutes)
router.use('/testimonials', testimonialRoutes)

export default router
