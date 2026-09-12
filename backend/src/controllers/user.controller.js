import * as userService from '../services/user.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listUsers = asyncHandler(async (req, res) => {
  res.json(await userService.listUsers(req.validatedQuery));
});

export const getUser = asyncHandler(async (req, res) => {
  res.json({ user: await userService.getUser(req.params.id) });
});

export const createUser = asyncHandler(async (req, res) => {
  res.status(201).json({ user: await userService.createUser(req.body) });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser({
    actor: req.user,
    id: req.params.id,
    payload: req.body,
  });
  res.json({ user });
});

export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser({ actor: req.user, id: req.params.id });
  res.json({ user });
});

export const dashboard = asyncHandler(async (_req, res) => {
  res.json(await userService.getAdminDashboard());
});
