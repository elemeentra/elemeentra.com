/* eslint-disable @next/next/no-img-element */

/** Built-in "E" mark, used until a logo is uploaded in Settings. */
export const DEFAULT_LOGO = "/brand/logo.png";

export interface BrandProps {
  siteName: string;
  /** Uploaded logo URL from Settings (null → built-in E mark). */
  logoUrl: string | null;
  /** Show the site name beside the logo. When false the name stays in the DOM as sr-only text (SEO + screen readers). */
  showText: boolean;
}

interface Props extends BrandProps {
  /** Height of the logo image in px. */
  size?: number;
  /** Class for the visible site-name text. */
  textClassName?: string;
  /** Optional second line under the name (e.g. "CMS"). */
  subtitle?: string;
  subtitleClassName?: string;
  /** Extra class on the wrapper around name + subtitle (e.g. to hide it on narrow screens). */
  textWrapClassName?: string;
  className?: string;
  /** Load eagerly (header / above the fold). */
  priority?: boolean;
}

/**
 * One logo for the whole product: public header + footer, splash screen,
 * admin sidebar and login all render this, so changing the logo (or the
 * "show text" switch) in Settings updates every place at once.
 */
export function BrandLogo({
  siteName,
  logoUrl,
  showText,
  size = 36,
  textClassName = "text-lg font-black tracking-tight",
  subtitle,
  subtitleClassName = "text-[10px] tracking-wide opacity-70",
  textWrapClassName = "",
  className = "",
  priority = false,
}: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={logoUrl || DEFAULT_LOGO}
        alt={showText ? "" : siteName}
        height={size}
        style={{ height: size, width: "auto", maxWidth: size * 4 }}
        className="block shrink-0 object-contain"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
      />
      {showText ? (
        <span className={`flex min-w-0 flex-col leading-tight ${textWrapClassName}`}>
          <span className={`truncate ${textClassName}`}>{siteName}</span>
          {subtitle && <span className={subtitleClassName}>{subtitle}</span>}
        </span>
      ) : (
        <span className="sr-only">{siteName}</span>
      )}
    </span>
  );
}
