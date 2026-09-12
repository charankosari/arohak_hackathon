'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * Accessible listbox, replacing a native <select> where the styling matters.
 *
 * Keyboard: Enter/Space/Arrow opens, Up/Down moves, Enter selects, Escape
 * closes and returns focus to the trigger. Follows the ARIA listbox pattern so
 * screen readers announce it as a normal combobox.
 */
export function Dropdown({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select…',
  className = '',
  align = 'left',
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState('down');
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();

  const selected = options.find((o) => o.value === value);

  // Open upward when the viewport has no room below.
  useEffect(() => {
    if (!open) return;
    const trigger = rootRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const needed = Math.min(options.length * 40 + 16, 272);
    const below = window.innerHeight - trigger.bottom;
    setPlacement(below < needed && trigger.top > below ? 'up' : 'down');
  }, [open, options.length]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Start the highlight on the current selection.
  useEffect(() => {
    if (open) {
      const index = options.findIndex((o) => o.value === value);
      setActive(index >= 0 ? index : 0);
    }
  }, [open, options, value]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function commit(index) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event) {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        setActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        commit(active);
        break;
      default:
        break;
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-ink-900"
      >
        <span className={selected ? '' : 'text-ink-400'}>{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          id={`${id}-list`}
          aria-label={label}
          tabIndex={-1}
          className={`animate-fade-up absolute z-50 max-h-64 min-w-full overflow-auto rounded-2xl border border-cream-300 bg-white p-1.5 shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${placement === 'up' ? 'bottom-full mb-3' : 'top-full mt-3'}`}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li key={String(option.value)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-active={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(index)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm whitespace-nowrap transition-colors ${
                    index === active ? 'bg-sky-100 text-ink-900' : 'text-ink-700'
                  }`}
                >
                  {option.label}
                  {isSelected && <Check className="size-4 shrink-0 text-sky-600" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
