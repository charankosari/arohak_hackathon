import * as hotelService from '../services/hotel.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listHotels = asyncHandler(async (req, res) => {
  res.json(await hotelService.listHotels({ actor: req.user, query: req.validatedQuery }));
});

export const getHotel = asyncHandler(async (req, res) => {
  res.json({ hotel: await hotelService.getHotel({ actor: req.user, id: req.params.id }) });
});

export const createHotel = asyncHandler(async (req, res) => {
  res.status(201).json({ hotel: await hotelService.createHotel(req.body) });
});

export const updateHotel = asyncHandler(async (req, res) => {
  res.json({ hotel: await hotelService.updateHotel(req.params.id, req.body) });
});

export const deleteHotel = asyncHandler(async (req, res) => {
  res.json(await hotelService.deleteHotel(req.params.id));
});
