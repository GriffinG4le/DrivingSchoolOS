import { useTheme } from '../theme/ThemeProvider.jsx';

export function Card({ title, subtitle, actions, children }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      style={{
        background: 'var(--card-bg, rgba(255,255,255,0.9))',
        border: '1px solid var(--card-border, rgba(229,231,235,0.9))',
        borderRadius: 16,
        padding: 16,
        boxShadow: 'var(--card-shadow, 0 10px 30px rgba(0,0,0,0.06))',
      }}
    >
      {(title || subtitle || actions) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            {title && (
            <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827' }}>
                {title}
              </div>
            )}
            {subtitle && (
            <div style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
