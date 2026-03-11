export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  onClick,
}) {
  const base = {
    borderRadius: 12,
    border: '1px solid transparent',
    padding: size === 'sm' ? '8px 10px' : '10px 12px',
    fontWeight: 700,
    fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease',
  };

  const stylesByVariant = {
    primary: {
      background:
        'var(--btn-primary-bg, linear-gradient(135deg, #2563eb, #4f46e5))',
      color: 'var(--btn-primary-fg, #ffffff)',
      boxShadow:
        'var(--btn-primary-shadow, 0 8px 20px rgba(37, 99, 235, 0.25))',
    },
    secondary: {
      background: 'var(--btn-secondary-bg, #111827)',
      color: 'var(--btn-secondary-fg, #ffffff)',
      boxShadow:
        'var(--btn-secondary-shadow, 0 8px 20px rgba(17, 24, 39, 0.18))',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--btn-ghost-fg, #111827)',
      border: '1px solid var(--btn-ghost-border, #e5e7eb)',
      boxShadow: 'none',
    },
    danger: {
      background: 'var(--btn-danger-bg, #ef4444)',
      color: 'var(--btn-danger-fg, #ffffff)',
      boxShadow:
        'var(--btn-danger-shadow, 0 8px 20px rgba(239, 68, 68, 0.18))',
    },
  };

  const style = { ...base, ...(stylesByVariant[variant] || stylesByVariant.primary) };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={style}
      onMouseDown={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = 'translateY(1px)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'translateY(0px)';
      }}
    >
      {children}
    </button>
  );
}

