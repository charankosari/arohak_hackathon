'use client';

import { Pencil, Plus, UserMinus, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
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
  Th,
} from '@/components/ui';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';

const ROLE_TABS = [
  { key: '', label: 'Everyone' },
  { key: 'ADMIN', label: 'Administrators' },
  { key: 'RECEPTIONIST', label: 'Receptionists' },
  { key: 'CUSTOMER', label: 'Guests' },
];

export default function UsersPage() {
  const { user: me } = useAuth();

  const [data, setData] = useState(null);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null); // user object, or 'new'
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.users.list({ ...(role ? { role } : {}), search, take: 100 }));
    } catch (err) {
      setError(err.message);
      setData({ users: [], total: 0 });
    }
  }, [role, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function deactivate(target) {
    setError(null);
    try {
      await api.users.deactivate(target.id);
      setNotice({ tone: 'success', text: `${target.name} has been deactivated.` });
      setConfirmDeactivate(null);
      load();
    } catch (err) {
      setError(err.message);
      setConfirmDeactivate(null);
    }
  }

  async function reactivate(target) {
    setError(null);
    try {
      await api.users.update(target.id, { isActive: true });
      setNotice({ tone: 'success', text: `${target.name} has been reactivated.` });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink-900">Staff &amp; guests</h1>
          <p className="mt-1 text-sm text-ink-500">
            Create receptionist and administrator accounts, and manage guest access.
          </p>
        </div>
        <Button variant="brass" onClick={() => setEditing('new')}>
          <Plus className="size-4" />
          Add account
        </Button>
      </header>

      {notice && (
        <Alert tone={notice.tone} className="animate-fade-up">
          {notice.text}
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.key || 'all'}
              type="button"
              onClick={() => setRole(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                role === tab.key
                  ? 'bg-ink-900 font-medium text-white'
                  : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-64"
        />
      </div>

      <Card>
        <CardHeader title="Accounts" subtitle={data ? `${data.total} total` : undefined} />
        {data === null ? (
          <LoadingBlock rows={5} />
        ) : data.users.length === 0 ? (
          <EmptyState icon={Users} title="No accounts match this filter" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Phone</Th>
                <Th>Joined</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((account) => (
                <tr key={account.id} className={account.isActive ? 'hover:bg-ink-50' : 'bg-ink-50/60'}>
                  <Td>
                    <span className="font-medium text-ink-900">{account.name}</span>
                    {account.id === me?.id && (
                      <span className="ml-2 text-xs text-brass-600">you</span>
                    )}
                    {!account.isActive && (
                      <Badge tone="bg-rose-50 text-rose-700 ring-rose-200" className="ml-2">
                        Deactivated
                      </Badge>
                    )}
                  </Td>
                  <Td className="text-ink-600">{account.email}</Td>
                  <Td>
                    <Badge status={account.role}>{ROLE_LABELS[account.role]}</Badge>
                  </Td>
                  <Td className="text-ink-600">{account.phone ?? '-'}</Td>
                  <Td className="whitespace-nowrap text-ink-500">{formatDate(account.createdAt)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setEditing(account)}>
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      {account.isActive ? (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={account.id === me?.id}
                          title={
                            account.id === me?.id
                              ? 'You cannot deactivate your own account'
                              : 'Deactivate'
                          }
                          onClick={() => setConfirmDeactivate(account)}
                        >
                          <UserMinus className="size-3.5" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="quiet" onClick={() => reactivate(account)}>
                          Reactivate
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

      <UserDialog
        account={editing}
        onClose={() => setEditing(null)}
        onDone={(message) => {
          setNotice({ tone: 'success', text: message });
          load();
        }}
      />

      <Modal
        open={!!confirmDeactivate}
        onClose={() => setConfirmDeactivate(null)}
        title="Deactivate this account?"
        description={confirmDeactivate?.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>
              Keep active
            </Button>
            <Button variant="danger" onClick={() => deactivate(confirmDeactivate)}>
              Deactivate
            </Button>
          </>
        }
      >
        <Alert tone="warn">
          They will be signed out and unable to sign in again. Their booking history is kept, and
          you can reactivate the account at any time. Accounts are never deleted, so past
          reservations stay auditable.
        </Alert>
      </Modal>
    </div>
  );
}

function UserDialog({ account, onClose, onDone }) {
  const isNew = account === 'new';
  const open = !!account;

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'RECEPTIONIST',
    phone: '',
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFieldErrors({});
    setForm(
      isNew
        ? { name: '', email: '', password: '', role: 'RECEPTIONIST', phone: '' }
        : {
            name: account.name,
            email: account.email,
            password: '',
            role: account.role,
            phone: account.phone ?? '',
          }
    );
  }, [open, isNew, account]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit() {
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (isNew) {
        await api.users.create({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        });
        onDone?.(`${form.name} created as ${ROLE_LABELS[form.role].toLowerCase()}.`);
      } else {
        await api.users.update(account.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          phone: form.phone.trim(),
          // Only send a password when one was actually typed.
          ...(form.password ? { password: form.password } : {}),
        });
        onDone?.(`${form.name} updated.`);
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
      title={isNew ? 'Add an account' : `Edit ${account?.name ?? ''}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="brass" onClick={submit} loading={submitting}>
            {isNew ? 'Create account' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="Full name" required error={fieldErrors.name}>
          <Input value={form.name} onChange={set('name')} error={fieldErrors.name} />
        </Field>

        <Field label="Email address" required error={fieldErrors.email}>
          <Input type="email" value={form.email} onChange={set('email')} error={fieldErrors.email} />
        </Field>

        <Field label="Role" required>
          <Select value={form.role} onChange={set('role')}>
            <option value="CUSTOMER">Guest - browse and book rooms</option>
            <option value="RECEPTIONIST">
              Receptionist - front desk, bookings, cancellations
            </option>
            <option value="ADMIN">Administrator - full access</option>
          </Select>
        </Field>

        <Field label="Phone number" error={fieldErrors.phone}>
          <Input
            type="tel"
            value={form.phone}
            onChange={set('phone')}
            placeholder="+91 98200 10000"
            error={fieldErrors.phone}
          />
        </Field>

        <Field
          label={isNew ? 'Password' : 'New password'}
          required={isNew}
          error={fieldErrors.password}
          hint={isNew ? 'At least 8 characters' : 'Leave blank to keep the current password'}
        >
          <Input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            error={fieldErrors.password}
          />
        </Field>

        {form.role === 'RECEPTIONIST' && (
          <Alert tone="info" className="text-xs">
            Receptionists can manage bookings, room status, availability and cancellations. They
            cannot manage hotels, room inventory, rates, or accounts.
          </Alert>
        )}
      </div>
    </Modal>
  );
}
