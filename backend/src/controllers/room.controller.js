import * as availabilityService from '../services/availability.service.js';
import * as roomService from '../services/room.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listRooms = asyncHandler(async (req, res) => {
  res.json(await roomService.listRooms({ actor: req.user, query: req.validatedQuery }));
});

export const getRoom = asyncHandler(async (req, res) => {
  res.json({ room: await roomService.getRoom(req.params.id) });
});

export const getRoomTypes = asyncHandler(async (req, res) => {
  res.json(await roomService.getRoomTypes(req.validatedQuery.hotelId));
});

export const createRoom = asyncHandler(async (req, res) => {
  res.status(201).json({ room: await roomService.createRoom(req.body) });
});

export const updateRoom = asyncHandler(async (req, res) => {
  // Receptionists may only touch operational fields, not commercial ones.
  roomService.assertRoomUpdateAllowed(req.user.role, req.body);
  res.json({ room: await roomService.updateRoom(req.params.id, req.body) });
});

export const deleteRoom = asyncHandler(async (req, res) => {
  res.json(await roomService.deleteRoom(req.params.id));
});

export const searchAvailability = asyncHandler(async (req, res) => {
  res.json(await availabilityService.searchAvailableRooms(req.validatedQuery));
});

/** Can THIS room take THIS stay? Powers the room page's live check. */
export const roomAvailability = asyncHandler(async (req, res) => {
  const { checkIn, checkOut, guests } = req.validatedQuery;
  res.json(
    await availabilityService.checkRoomAvailability({
      roomId: req.params.id,
      checkIn,
      checkOut,
      guests,
    })
  );
});

export const roomCalendar = asyncHandler(async (req, res) => {
  const { from, to } = req.validatedQuery;
  res.json(await availabilityService.getRoomCalendar({ roomId: req.params.id, from, to }));
});
