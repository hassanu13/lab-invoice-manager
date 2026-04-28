import Image from 'next/image';

/**
 * Horizontal DSD logo, used in the running header and on the cover screen.
 * The SVG file ships in /public/brand/.
 */
export function DSDLogo({ className, size = 200 }: { className?: string; size?: number }) {
  return (
    <Image
      src="/brand/logo-horizontal-eggshell.svg"
      alt="Dream Smiles Dental"
      width={size}
      height={Math.round(size * 0.25)}
      priority
      className={className}
      style={{ width: size, height: 'auto' }}
    />
  );
}
