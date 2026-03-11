export function formatKesFromCents(amountCents) {
  const value = Number(amountCents || 0) / 100;
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

