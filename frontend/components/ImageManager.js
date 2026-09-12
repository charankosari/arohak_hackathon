'use client';

import { ImagePlus, Loader2, Star, Trash2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { api } from '@/lib/api';

const MAX_MB = 8;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';

/**
 * Admin gallery manager for a hotel or a room.
 *
 * `owner` is 'hotels' or 'rooms'; both expose the same nested endpoints.
 * The first image (position 0) is the cover shown everywhere else, so
 * "Make cover" simply moves an image to the front of the order.
 */
export function ImageManager({ owner, id, label }) {
  const [images, setImages] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { images: list } = await api.images.list(owner, id);
      setImages(list);
    } catch (err) {
      setError(err.message);
      setImages([]);
    }
  }, [owner, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(fileList) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;

    const tooBig = files.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`"${tooBig.name}" is larger than ${MAX_MB} MB. Please compress it first.`);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await api.images.upload(owner, id, files);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function makeCover(imageId) {
    setBusy(true);
    setError(null);
    try {
      // Cover = position 0, so move this id to the front and keep the rest.
      const ordered = [imageId, ...images.filter((i) => i.id !== imageId).map((i) => i.id)];
      const { images: list } = await api.images.reorder(owner, id, ordered);
      setImages(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(imageId) {
    setBusy(true);
    setError(null);
    try {
      await api.images.remove(owner, id, imageId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!id) {
    return (
      <Alert tone="info" className="text-xs">
        Save this {owner === 'hotels' ? 'hotel' : 'room'} first, then reopen it to add
        photographs.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragging ? 'border-brass-500 bg-brass-50' : 'border-ink-200 bg-cream-100'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          id={`upload-${owner}-${id}`}
          onChange={(e) => upload(e.target.files)}
        />

        <ImagePlus className="mx-auto size-6 text-ink-400" aria-hidden />
        <p className="mt-2 text-sm text-ink-600">
          Drag photographs here, or{' '}
          <label
            htmlFor={`upload-${owner}-${id}`}
            className="cursor-pointer font-medium text-brass-700 underline underline-offset-2"
          >
            choose files
          </label>
        </p>
        <p className="mt-1 text-xs text-ink-400">
          JPEG, PNG, WebP or AVIF · up to {MAX_MB} MB each · 8 at a time
        </p>

        {busy && (
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-ink-500">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Uploading to Cloudinary…
          </p>
        )}
      </div>

      {/* Existing gallery */}
      {images === null ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-4/3 animate-pulse rounded-lg bg-ink-100" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <p className="text-xs text-ink-400">
          No photographs yet. {label ? `${label} will` : 'This will'} show a placeholder until
          one is added.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="group relative aspect-4/3 overflow-hidden rounded-lg bg-ink-100 ring-1 ring-ink-200"
              >
                <Image
                  src={image.url}
                  alt={image.alt || `Photograph ${index + 1}`}
                  fill
                  sizes="160px"
                  className="object-cover"
                />

                {index === 0 && (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-brass-500 px-2 py-0.5 text-[10px] font-medium text-ink-950">
                    <Star className="size-2.5 fill-current" aria-hidden />
                    Cover
                  </span>
                )}

                {/* Actions appear on hover, and on focus for keyboard users. */}
                <div className="absolute inset-0 flex items-end justify-between gap-1 bg-linear-to-t from-ink-950/80 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {index !== 0 ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => makeCover(image.id)}
                      className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-ink-800 hover:bg-white disabled:opacity-50"
                    >
                      Make cover
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(image.id)}
                    aria-label={`Delete photograph ${index + 1}`}
                    className="rounded-md bg-rose-600/90 p-1.5 text-white hover:bg-rose-600 disabled:opacity-50"
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-ink-400">
            {images.length} photograph{images.length === 1 ? '' : 's'} · the cover is used on
            cards and search results.
          </p>
        </>
      )}
    </div>
  );
}

/** Compact upload button, for use in a table row. */
export function QuickUpload({ owner, id, onDone }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handle(files) {
    if (!files?.length) return;
    setBusy(true);
    try {
      await api.images.upload(owner, id, Array.from(files));
      onDone?.();
    } catch (err) {
      onDone?.(err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => handle(e.target.files)}
      />
      <Button
        size="sm"
        variant="outline"
        loading={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3.5" />
        Photos
      </Button>
    </>
  );
}
