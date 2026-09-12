import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req, res) => {
  res.json(await authService.login(req.body));
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: await authService.getProfile(req.user.id) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  res.json({ user: await authService.updateProfile(req.user.id, req.body) });
});

export const changePassword = asyncHandler(async (req, res) => {
  res.json(await authService.changePassword(req.user.id, req.body));
});
