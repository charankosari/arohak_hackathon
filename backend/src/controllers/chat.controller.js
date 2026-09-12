import * as chatService from '../services/chat.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const ask = asyncHandler(async (req, res) => {
  res.json(await chatService.ask(req.body));
});

export const search = asyncHandler(async (req, res) => {
  res.json(await chatService.search(req.body));
});

export const health = asyncHandler(async (_req, res) => {
  const status = await chatService.health();
  res.status(status.status === 'up' ? 200 : 503).json({ agent: status });
});
