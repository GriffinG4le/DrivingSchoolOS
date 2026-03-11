import { useMemo, useState } from 'react';
import { Card } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';
import { Field, Input } from '../components/Field.jsx';
import { formatKesFromCents } from '../lib/money.js';
import { listPayments } from '../mock/db.js';

export function LivePayments() {
  const [limit, setLimit] = useState('25');
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const base = listPayments();
    const q = String(query || '').trim().toLowerCase();
    const filtered = q
      ? base.filter((p) => {
          return (
            String(p.mpesa_receipt || '').toLowerCase().includes(q) ||
            String(p.payer_name || '').toLowerCase().includes(q) ||
            String(p.admission_number || '').toLowerCase().includes(q)
          );
        })
      : base;
    const n = Math.max(1, Math.min(200, Number(limit) || 25));
    return filtered.slice(0, n);
  }, [limit, query]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card title="Payment Tracing" subtitle="Search by M-Pesa code, name, or account (admission number).">
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '220px 1fr' }}>
          <Field label="Show last N">
            <Input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="numeric" />
          </Field>
          <div style={{ alignSelf: 'end', fontSize: 13, color: '#6b7280' }}>
            <Field label="Search">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="M-Pesa code, payer name, or account (SCH-...)"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Payments" subtitle={`${rows.length} row(s)`}>
        {rows.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b7280' }}>No payments yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((p) => (
              <div
                key={p.payment_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 0.8fr 0.6fr',
                  gap: 10,
                  padding: 12,
                  borderRadius: 14,
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'grid', gap: 2 }}>
                  <div style={{ fontWeight: 950 }}>
                    {formatKesFromCents(p.amount)}{' '}
                    <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 800 }}>
                      ({p.mpesa_receipt})
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Admission: {p.admission_number}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 800 }}>
                  {p.payer_phone || '—'}
                </div>
                <div style={{ justifySelf: 'end' }}>
                  <Badge>RECORDED</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

