// ============================================
// Nova-Scheduler — Auth Controller
// ============================================

import { Request, Response } from 'express';
import authService from './auth.service';
import { sendSuccess, sendCreated } from '../../shared/utils/apiResponse';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const result = await authService.register(req.body);
    sendCreated(res, result, 'User registered successfully');
  }

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body);
    sendSuccess(res, result, 'Login successful');
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    const user = await authService.getProfile(req.user!.userId);
    sendSuccess(res, user, 'Profile retrieved successfully');
  }
}

export default new AuthController();
