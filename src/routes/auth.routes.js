import express from 'express';
import { register, login, logout, getProfile, forgotPassword, resetPassword, setPasswordFromInvitation } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/profile', authenticate, getProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/set-password', setPasswordFromInvitation);

export default router;
