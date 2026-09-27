import type { LucideIcon } from 'lucide-react';

/** One Tab stop, automatic activation, and a stable relationship to the visible panel. */
export function Tabs({
  id,
  label,
  className,
  value,
  onChange,
  items,
}: {
  id: string;
  label: string;
  className: string;
  value: string;
  onChange: (value: string) => void;
  items: { key: string; label: string; icon: LucideIcon }[];
}) {
  return (
    <div className={className} role="tablist" aria-label={label}>
      {items.map(({ key, label, icon: Icon }, index) => (
        <button
          key={key}
          id={`${id}-tab-${key}`}
          role="tab"
          aria-selected={value === key}
          aria-controls={`${id}-panel-${key}`}
          tabIndex={value === key ? 0 : -1}
          onClick={() => onChange(key)}
          onKeyDown={(event) => {
            const next =
              event.key === 'ArrowRight'
                ? (index + 1) % items.length
                : event.key === 'ArrowLeft'
                  ? (index + items.length - 1) % items.length
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : undefined;
            if (next === undefined) return;
            event.preventDefault();
            onChange(items[next].key);
            const buttons =
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                '[role="tab"]',
              );
            buttons?.[next].focus();
          }}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
