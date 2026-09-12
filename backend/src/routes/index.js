import { Router } from 'express';
import authRoutes from './auth.routes.js';
import bookingRoutes from './booking.routes.js';
import cancellationRoutes from './cancellation.routes.js';
import chatRoutes from './chat.routes.js';
import hotelRoutes from './hotel.routes.js';
import roomRoutes from './room.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/hotels', hotelRoutes);
router.use('/rooms', roomRoutes);
router.use('/bookings', bookingRoutes);
router.use('/cancellation-requests', cancellationRoutes);
router.use('/chat', chatRoutes);

export default router;
