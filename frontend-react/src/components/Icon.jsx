import { ICONS } from "@domain/icons";

export function Icon({ name, size = 24, color, className = "ic" }) {
  const body = ICONS[name] || ICONS.training || '<circle cx="12" cy="12" r="4"/>';
  const style = color ? ` style="color:${color}"` : "";
  return (
    <span
      className={className}
      style={{ display: "inline-flex", lineHeight: 0 }}
      dangerouslySetInnerHTML={{
        __html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${style}>${body}</svg>`,
      }}
    />
  );
}
