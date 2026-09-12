'use client';

import { Building2, Mail, MapPin, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
  Textarea,
} from '@/components/ui';
import { api } from '@/lib/api';

export default function HotelsPage() {
  const [hotels, setHotels] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null); // hotel object, or 'new'
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { hotels: list } = await api.hotels.list({ take: 50 });
      setHotels(list);
    } catch (err) {
      setError(err.message);
      setHotels([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleStatus(hotel) {
    setError(null);
    const next = hotel.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.hotels.update(hotel.id, { status: next });
      setNotice({
        tone: 'success',
        text: `${hotel.name} is now ${next === 'ACTIVE' ? 'accepting bookings' : 'off sale'}.`,
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(hotel) {
    setError(null);
    try {
      await api.hotels.remove(hotel.id);
      setNotice({ tone: 'success', text: `${hotel.name} deleted.` });
      setConfirmDelete(null);
      load();
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink-900">Hotels</h1>
          <p className="mt-1 text-sm text-ink-500">
            Property records. Setting a hotel inactive removes it from guest search immediately.
          </p>
        </div>
        <Button variant="brass" onClick={() => setEditing('new')}>
          <Plus className="size-4" />
          Add hotel
        </Button>
      </header>

      {notice && (
        <Alert tone={notice.tone} className="animate-fade-up">
          {notice.text}
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      {hotels === null ? (
        <Card>
          <LoadingBlock rows={3} />
        </Card>
      ) : hotels.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No hotels yet"
            action={
              <Button variant="brass" onClick={() => setEditing('new')}>
                Add the first hotel
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {hotels.map((hotel) => (
            <Card key={hotel.id} className="overflow-hidden">
              <CardHeader
                title={hotel.name}
                subtitle={hotel.code}
                action={<Badge status={hotel.status} />}
              />
              <div className="space-y-2.5 p-5 text-sm">
                <p className="flex items-start gap-2 text-ink-600">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                  {hotel.address}, {hotel.city}
                </p>
                <p className="flex items-center gap-2 text-ink-600">
                  <Phone className="size-4 shrink-0 text-ink-400" aria-hidden />
                  {hotel.contactNumber}
                </p>
                <p className="flex items-center gap-2 text-ink-600">
                  <Mail className="size-4 shrink-0 text-ink-400" aria-hidden />
                  {hotel.email}
                </p>
                {hotel.description && (
                  <p className="border-t border-ink-100 pt-2.5 text-ink-500">{hotel.description}</p>
                )}
                <p className="text-xs text-ink-400">
                  {hotel.roomCount ?? 0} {hotel.roomCount === 1 ? 'room' : 'rooms'}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3">
                <Button size="sm" variant="outline" onClick={() => toggleStatus(hotel)}>
                  {hotel.status === 'ACTIVE' ? 'Take off sale' : 'Put on sale'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(hotel)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmDelete(hotel)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <HotelDialog
        hotel={editing}
        onClose={() => setEditing(null)}
        onDone={(message) => {
          setNotice({ tone: 'success', text: message });
          load();
        }}
      />

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete this hotel?"
        description={confirmDelete?.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Keep hotel
            </Button>
            <Button variant="danger" onClick={() => remove(confirmDelete)}>
              Delete hotel
            </Button>
          </>
        }
      >
        <Alert tone="warn">
          A hotel with any booking history cannot be deleted, because that history must be
          preserved. To stop taking bookings, set its status to <strong>Inactive</strong> instead.
        </Alert>
      </Modal>
    </div>
  );
}

function HotelDialog({ hotel, onClose, onDone }) {
  const isNew = hotel === 'new';
  const open = !!hotel;

  const blank = {
    code: '',
    name: '',
    address: '',
    city: '',
    description: '',
    contactNumber: '',
    email: '',
    status: 'ACTIVE',
  };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFieldErrors({});
    setForm(
      isNew
        ? blank
        : {
            code: hotel.code,
            name: hotel.name,
            address: hotel.address,
            city: hotel.city,
            description: hotel.description ?? '',
            contactNumber: hotel.contactNumber,
            email: hotel.email,
            status: hotel.status,
          }
    );
    // `blank` is a stable literal; re-creating it each render is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isNew, hotel]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit() {
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      contactNumber: form.contactNumber.trim(),
      email: form.email.trim(),
      status: form.status,
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
    };

    try {
      if (isNew) {
        await api.hotels.create(payload);
        onDone?.(`${payload.name} created.`);
      } else {
        await api.hotels.update(hotel.id, payload);
        onDone?.(`${payload.name} updated.`);
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
      title={isNew ? 'Add a hotel' : `Edit ${hotel?.name ?? ''}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="brass" onClick={submit} loading={submitting}>
            {isNew ? 'Create hotel' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Hotel ID"
            required
            error={fieldErrors.code}
            hint="Short code, e.g. HGMUM001"
          >
            <Input
              value={form.code}
              onChange={set('code')}
              placeholder="HGMUM001"
              error={fieldErrors.code}
            />
          </Field>
          <Field label="Status" required>
            <Select value={form.status} onChange={set('status')}>
              <option value="ACTIVE">Active - accepting bookings</option>
              <option value="INACTIVE">Inactive - off sale</option>
            </Select>
          </Field>
        </div>

        <Field label="Hotel name" required error={fieldErrors.name}>
          <Input
            value={form.name}
            onChange={set('name')}
            placeholder="The Meridian Grand Mumbai"
            error={fieldErrors.name}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field label="Address" required error={fieldErrors.address}>
            <Input
              value={form.address}
              onChange={set('address')}
              placeholder="18 Marine View Road, Nariman Point"
              error={fieldErrors.address}
            />
          </Field>
          <Field label="City" required error={fieldErrors.city}>
            <Input
              value={form.city}
              onChange={set('city')}
              placeholder="Mumbai"
              error={fieldErrors.city}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact number" required error={fieldErrors.contactNumber}>
            <Input
              value={form.contactNumber}
              onChange={set('contactNumber')}
              placeholder="+91 22 4567 8900"
              error={fieldErrors.contactNumber}
            />
          </Field>
          <Field label="Email address" required error={fieldErrors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="reservations@example.com"
              error={fieldErrors.email}
            />
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={set('description')}
            placeholder="A seafront property on Marine Drive with sea-view suites..."
            maxLength={2000}
          />
        </Field>
      </div>
    </Modal>
  );
}
