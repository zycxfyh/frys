/**
 * 认证路由
 */

import express from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { AuthenticationMiddleware } from '../../infrastructure/auth/AuthenticationMiddleware.js';
import { AuthorizationService } from '../../domain/services/auth/AuthorizationService.js';

export function createAuthRoutes(authService, authzService) {
  const router = express.Router();
  const authController = new AuthController(authService, authzService);
  const authMiddleware = new AuthenticationMiddleware(authService);

  // 公开路由（不需要认证）
  router.post('/register', authController.register.bind(authController));
  router.post('/login', authController.login.bind(authController));
  router.post('/refresh', authController.refreshToken.bind(authController));
  router.post(
    '/forgot-password',
    authController.forgotPassword.bind(authController),
  );
  router.get('/verify-email', authController.verifyEmail.bind(authController));

  // 需要认证的路由
  router.use(authMiddleware.authenticate());

  router.post('/logout', authController.logout.bind(authController));
  router.get('/me', authController.getCurrentUser.bind(authController));
  router.put('/password', authController.changePassword.bind(authController));
  router.get('/verify', authController.verifyToken.bind(authController));

  // 用户会话管理
  router.get('/sessions', authController.getUserSessions.bind(authController));
  router.delete(
    '/sessions/:sessionId',
    authController.terminateSession.bind(authController),
  );

  // 管理员路由（需要特定权限）
  const requireAdmin = authzService.createPermissionMiddleware('auth:admin');
  router.post(
    '/reset-password',
    requireAdmin,
    authController.resetPassword.bind(authController),
  );
  router.get(
    '/stats',
    requireAdmin,
    authController.getAuthStats.bind(authController),
  );

  // 其他用户会话管理（管理员权限）
  router.get(
    '/users/:userId/sessions',
    requireAdmin,
    authController.getUserSessions.bind(authController),
  );
  router.delete(
    '/users/:userId/sessions/:sessionId',
    requireAdmin,
    authController.terminateSession.bind(authController),
  );

  return router;
}
