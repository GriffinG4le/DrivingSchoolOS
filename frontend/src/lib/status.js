export function statusTone(status) {
  switch (status) {
    case 'CLEARED':
      return { bg: '#dcfce7', fg: '#166534', border: '#86efac' };
    case 'PARTIAL':
      return { bg: '#ffedd5', fg: '#9a3412', border: '#fdba74' };
    case 'UNPAID':
      return { bg: '#fee2e2', fg: '#991b1b', border: '#fca5a5' };
    case 'OVERPAID':
      return { bg: '#dbeafe', fg: '#1e40af', border: '#93c5fd' };
    default:
      return { bg: '#f3f4f6', fg: '#111827', border: '#d1d5db' };
  }
}

