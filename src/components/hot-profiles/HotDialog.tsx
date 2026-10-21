import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export const hotInput =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
export const hotButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
export const hotPrimary = `${hotButton} border-primary bg-primary text-primary-foreground hover:bg-primary/90`;

export function HotDialog({
  title,
  description,
  onClose,
  children,
  busy = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            event.stopPropagation();
            onClose();
          }
          if (event.key === "Tab") {
            const controls = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
              ) ?? [],
            ).filter((element) => element.getClientRects().length);
            const first = controls[0],
              last = controls[controls.length - 1];
            if (
              event.shiftKey &&
              (document.activeElement === first || document.activeElement === ref.current)
            ) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="font-display text-xl font-bold">{title}</h2>
            {description && (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Fechar janela"
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="overflow-y-auto p-5">{children}</div>
      </section>
    </div>
  );
}
