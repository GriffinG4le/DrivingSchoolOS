import { useTheme } from '../theme/ThemeProvider.jsx';

export function Field({ label, hint, children }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827' }}>
          {label}
        </span>
        {hint && (
          <span style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280' }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid var(--input-border, #e5e7eb)',
        background: 'var(--input-bg, #ffffff)',
        color: 'var(--input-fg, #111827)',
        fontSize: 14,
        outline: 'none',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#93c5fd';
        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.12)';
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#e5e7eb';
        e.currentTarget.style.boxShadow = 'none';
        props.onBlur?.(e);
      }}
    />
  );
}

export function Select(props) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid var(--input-border, #e5e7eb)',
        background: 'var(--input-bg, #ffffff)',
        color: 'var(--input-fg, #111827)',
        fontSize: 14,
        outline: 'none',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#93c5fd';
        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.12)';
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#e5e7eb';
        e.currentTarget.style.boxShadow = 'none';
        props.onBlur?.(e);
      }}
    />
  );
}
