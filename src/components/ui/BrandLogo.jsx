import Image from 'next/image';

// CSS follows the existing theme class without reading the DOM during render.
// Explicit surfaces keep dark login/marketing heroes correct in either theme.
export default function BrandLogo({ surface = 'auto', width = 240, style }) {
  const variants = surface === 'auto' ? ['light', 'dark'] : [surface];
  return (
    <span className={`courtiq-brand-logo courtiq-brand-${surface}`} style={{ width, maxWidth: '100%', display: 'inline-block', verticalAlign: 'middle', ...style }}>
      {variants.map(variant => (
        <Image key={variant} className={`courtiq-brand-image-${variant}`} src={`/brand/courtiq-v2/courtiq-logo-${variant}.svg`} alt="CourtIQ" width={679} height={120} style={{ width: '100%', height: 'auto' }} />
      ))}
    </span>
  );
}
