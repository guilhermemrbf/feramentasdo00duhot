import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type HeadingProps = { id: string; icon: LucideIcon; title: string; children: ReactNode };

export function SettingsSectionHeading({ id, icon: Icon, title, children }: HeadingProps) {
  return (
    <header className="settings-section-heading">
      <span>
        <Icon size={20} aria-hidden />
      </span>
      <div>
        <h2 id={id}>{title}</h2>
        <p>{children}</p>
      </div>
    </header>
  );
}

export function SettingsCardHeading({ id, icon: Icon, title, children }: HeadingProps) {
  return (
    <header className="settings-card-heading">
      <h3 id={id}>
        <Icon size={16} aria-hidden /> {title}
      </h3>
      <p>{children}</p>
    </header>
  );
}
