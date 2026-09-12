'use client';

import { BedDouble, CalendarDays, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ImageManager } from '@/components/ImageManager';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  Select,
  TableWrap,
  Td,
  Textarea,
  Th,
} from '@/components/ui';
import { SmartImage } from '@/components/SmartImage';
import { api } from '@/lib/api';
import { ROOM_STATUSES } from '@/lib/constants';
import { addDaysISO, formatDateShort, money, todayISO } from '@/lib/format';

export default function ManageRoomsPage() {
  const { isAdmin } = useAuth();

  const [rooms, setRooms] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [filters, setFilters] = useState({ status: '', roomType: '', search: '' });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null); // room object, or 'new'
  const [calendarRoom, setCalendarRoom] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { rooms: list } = await api.rooms.list({ ...filters, take: 100 });
      setRooms(list);
    } catch (err) {
      setError(err.message);
      setRooms([]);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.hotels
      .list({ take: 50 })
      .then(({ hotels: list }) => setHotels(list))
      .catch(() => setHotels([]));
  }, []);

  async function quickStatus(room, status) {
    setError(null);
    try {
      await api.rooms.update(room.id, { status });
      setNotice({ tone: 'success', text: `Room ${room.roomNumber} marked ${status.toLowerCase().replace(/_/g, ' ')}.` });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(room) {
    setError(null);
    try {
      await api.rooms.remove(room.id);
      setNotice({ tone: 'success', text: `Room ${room.roomNumber} deleted.` });
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  }

  const roomTypes = [...new Set((rooms ?? []).map((r) => r.roomType))].sort();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink-900">Rooms &amp; availability</h1>
          <p className="mt-1 text-sm text-ink-500">
            {isAdmin
              ? 'Manage the full room inventory, rates and operational status.'
              : 'Update room status and review occupancy. Rates and inventory are administrator-only.'}
          </p>
        </div>
        {isAdmin && (
          <Button variant="brass" onClick={() => setEditing('new')}>
            <Plus className="size-4" />
            Add room
          </Button>
        )}
      </header>

      {!isAdmin && (
        <Alert tone="info">
          <span className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            As a receptionist you can change a room&rsquo;s status and description. Changing the
            rate, type, capacity, or adding and removing rooms requires an administrator.
          </span>
        </Alert>
      )}

      {notice && (
        <Alert tone={notice.tone} className="animate-fade-up">
          {notice.text}
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Status">
            <Select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All statuses</option>
              {ROOM_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Room type">
            <Select
              value={filters.roomType}
              onChange={(e) => setFilters((f) => ({ ...f, roomType: e.target.value }))}
            >
              <option value="">All types</option>
              {roomTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search">
            <Input
              placeholder="Room number or type"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </Field>
          <div className="flex items-end">
            <Button
              variant="quiet"
              className="w-full"
              onClick={() => setFilters({ status: '', roomType: '', search: '' })}
            >
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Room inventory" subtitle={rooms ? `${rooms.length} rooms` : undefined} />
        {rooms === null ? (
          <LoadingBlock rows={5} />
        ) : rooms.length === 0 ? (
          <EmptyState icon={BedDouble} title="No rooms match these filters" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Photo</Th>
                <Th>Room</Th>
                <Th>Type</Th>
                <Th>Capacity</Th>
                <Th>Rate / night</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-cream-100">
                  <Td>
                    <div className="relative size-12 overflow-hidden rounded-md bg-ink-100 ring-1 ring-ink-200">
                      <SmartImage
                        image={room.coverImage}
                        alt={`Room ${room.roomNumber}`}
                        sizes="48px"
                      />
                    </div>
                  </Td>
                  <Td className="font-medium text-ink-900">{room.roomNumber}</Td>
                  <Td>
                    <p className="text-ink-900">{room.roomType}</p>
                    {room.amenities?.length > 0 && (
                      <p className="max-w-xs truncate text-xs text-ink-400">
                        {room.amenities.slice(0, 3).join(', ')}
                      </p>
                    )}
                  </Td>
                  <Td className="text-ink-700">{room.maxGuests}</Td>
                  <Td className="whitespace-nowrap font-medium text-ink-900">
                    {money(room.pricePerNight)}
                  </Td>
                  <Td>
                    <Select
                      value={room.status}
                      onChange={(e) => quickStatus(room, e.target.value)}
                      className="!w-auto !py-1 !text-xs"
                      aria-label={`Status for room ${room.roomNumber}`}
                    >
                      {ROOM_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setCalendarRoom(room)}>
                        <CalendarDays className="size-3.5" />
                        Calendar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(room)}>
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setConfirmDelete(room)}
                          aria-label={`Delete room ${room.roomNumber}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <RoomDialog
        room={editing}
        hotels={hotels}
        isAdmin={isAdmin}
        onClose={() => setEditing(null)}
        onDone={(message) => {
          setNotice({ tone: 'success', text: message });
          load();
        }}
      />

      <CalendarDialog room={calendarRoom} onClose={() => setCalendarRoom(null)} />

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete this room?"
        description={confirmDelete ? `Room ${confirmDelete.roomNumber}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Keep room
            </Button>
            <Button variant="danger" onClick={() => remove(confirmDelete)}>
              Delete room
            </Button>
          </>
        }
      >
        <Alert tone="warn">
          A room with any booking history cannot be deleted, because that history must be
          preserved. To take it off sale instead, set its status to{' '}
          <strong>Out of service</strong>.
        </Alert>
      </Modal>
    </div>
  );
}

/** Create or edit a room. Receptionists get a narrowed form. */
function RoomDialog({ room, hotels, isAdmin, onClose, onDone }) {
  const isNew = room === 'new';
  const open = !!room;

  const [form, setForm] = useState({
    hotelId: '',
    roomNumber: '',
    roomType: '',
    maxGuests: 2,
    pricePerNight: '',
    status: 'AVAILABLE',
    description: '',
    amenities: '',
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFieldErrors({});

    if (isNew) {
      setForm({
        hotelId: hotels[0]?.id ?? '',
        roomNumber: '',
        roomType: '',
        maxGuests: 2,
        pricePerNight: '',
        status: 'AVAILABLE',
        description: '',
        amenities: '',
      });
    } else {
      setForm({
        hotelId: room.hotelId,
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        maxGuests: room.maxGuests,
        pricePerNight: String(room.pricePerNight),
        status: room.status,
        description: room.description ?? '',
        amenities: (room.amenities ?? []).join(', '),
      });
    }
  }, [open, isNew, room, hotels]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit() {
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    const amenities = form.amenities
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    try {
      if (isNew) {
        await api.rooms.create({
          hotelId: form.hotelId,
          roomNumber: form.roomNumber.trim(),
          roomType: form.roomType.trim(),
          maxGuests: Number(form.maxGuests),
          pricePerNight: Number(form.pricePerNight),
          status: form.status,
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
          amenities,
        });
        onDone?.(`Room ${form.roomNumber} created.`);
      } else if (isAdmin) {
        await api.rooms.update(room.id, {
          roomNumber: form.roomNumber.trim(),
          roomType: form.roomType.trim(),
          maxGuests: Number(form.maxGuests),
          pricePerNight: Number(form.pricePerNight),
          status: form.status,
          description: form.description.trim(),
          amenities,
        });
        onDone?.(`Room ${form.roomNumber} updated.`);
      } else {
        // Receptionist: only the fields the API will accept from them.
        await api.rooms.update(room.id, {
          status: form.status,
          description: form.description.trim(),
        });
        onDone?.(`Room ${room.roomNumber} updated.`);
      }
      onClose();
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors ?? {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isNew ? 'Add a room' : `Edit room ${room?.roomNumber ?? ''}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="brass" onClick={submit} loading={submitting}>
            {isNew ? 'Create room' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        {isNew && (
          <Field label="Hotel" required error={fieldErrors.hotelId}>
            <Select value={form.hotelId} onChange={set('hotelId')}>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name} ({hotel.code})
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Room number" required error={fieldErrors.roomNumber}>
            <Input
              value={form.roomNumber}
              onChange={set('roomNumber')}
              placeholder="1204"
              disabled={!isAdmin && !isNew}
              error={fieldErrors.roomNumber}
            />
          </Field>
          <Field label="Room type" required error={fieldErrors.roomType}>
            <Input
              value={form.roomType}
              onChange={set('roomType')}
              placeholder="Premier Sea View"
              disabled={!isAdmin && !isNew}
              error={fieldErrors.roomType}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Max guests" required error={fieldErrors.maxGuests}>
            <Input
              type="number"
              min={1}
              max={20}
              value={form.maxGuests}
              onChange={set('maxGuests')}
              disabled={!isAdmin && !isNew}
              error={fieldErrors.maxGuests}
            />
          </Field>
          <Field label="Rate per night (INR)" required error={fieldErrors.pricePerNight}>
            <Input
              type="number"
              min={1}
              step={100}
              value={form.pricePerNight}
              onChange={set('pricePerNight')}
              placeholder="12500"
              disabled={!isAdmin && !isNew}
              error={fieldErrors.pricePerNight}
            />
          </Field>
          <Field label="Status" required>
            <Select value={form.status} onChange={set('status')}>
              {ROOM_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={set('description')}
            placeholder="King bed, sea view, sofa chair."
            maxLength={2000}
          />
        </Field>

        <Field
          label="Amenities"
          hint="Comma separated"
        >
          <Textarea
            value={form.amenities}
            onChange={set('amenities')}
            placeholder="Complimentary Wi-Fi, Air conditioning, Sea view"
            disabled={!isAdmin && !isNew}
          />
        </Field>

        {isAdmin && (
          <div className="border-t border-ink-100 pt-4">
            <p className="mb-2 text-sm font-medium text-ink-700">Photographs</p>
            <ImageManager
              owner="rooms"
              id={isNew ? null : room?.id}
              label={isNew ? null : `Room ${room?.roomNumber}`}
            />
          </div>
        )}

        {!isAdmin && !isNew && (
          <Alert tone="info" className="text-xs">
            Greyed-out fields require an administrator. Your changes to status and description will
            be saved.
          </Alert>
        )}
      </div>
    </Modal>
  );
}

/** 14-day occupancy strip for one room. */
function CalendarDialog({ room, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!room) return;
    setData(null);
    setError(null);

    const from = todayISO();
    api.rooms
      .calendar(room.id, { from, to: addDaysISO(from, 14) })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [room]);

  return (
    <Modal
      open={!!room}
      onClose={onClose}
      size="lg"
      title={room ? `Room ${room.roomNumber} availability` : ''}
      description="Next 14 days"
    >
      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : !data ? (
        <LoadingBlock rows={2} />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1.5">
            {data.days.map((day) => (
              <div
                key={day.date}
                title={
                  day.booking
                    ? `${day.booking.guestName} (${day.booking.reference})`
                    : day.blockedBy
                      ? day.blockedBy.replace(/_/g, ' ').toLowerCase()
                      : 'Available'
                }
                className={`rounded-md border px-1.5 py-2 text-center ${
                  day.available
                    ? 'border-emerald-200 bg-emerald-50'
                    : day.blockedBy === 'BOOKING'
                      ? 'border-sky-200 bg-sky-50'
                      : 'border-amber-200 bg-amber-50'
                }`}
              >
                <p className="text-[10px] text-ink-500">{formatDateShort(day.date)}</p>
                <p className="mt-0.5 text-[10px] font-medium text-ink-700">
                  {day.available ? 'Free' : day.blockedBy === 'BOOKING' ? 'Booked' : 'Blocked'}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-500">
            {[
              ['border-emerald-200 bg-emerald-50', 'Available'],
              ['border-sky-200 bg-sky-50', 'Booked'],
              ['border-amber-200 bg-amber-50', 'Out of service / maintenance'],
            ].map(([classes, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`size-3 rounded border ${classes}`} />
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
