import { statusTone } from '../lib/status.js';

export function Badge({ children, tone }) {
  const t = tone || statusTone(String(children || '').toUpperCase());
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.fg,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.2,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

