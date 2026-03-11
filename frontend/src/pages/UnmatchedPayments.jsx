import { useMemo, useState } from 'react';
import { Card } from '../components/Card.jsx';
import { Field, Input } from '../components/Field.jsx';
import { Button } from '../components/Button.jsx';
import { formatKesFromCents } from '../lib/money.js';
import { assignUnmatchedPayment, listUnmatchedPayments } from '../mock/db.js';

export function UnmatchedPayments() {
  const [refreshKey, setRefreshKey] = useState(0);
  const rows = useMemo(() => listUnmatchedPayments(), [refreshKey]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card
        title="Unmatched Payments"
        subtitle="Payments with invalid admission numbers that need manual assignment."
      >
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          In the real system these come from M-Pesa callbacks where the account reference doesn’t match any admission.
        </div>
      </Card>

      <Card title="Queue" subtitle={`${rows.length} payment(s)`}>
        {rows.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b7280' }}>No unmatched payments.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((p) => (
              <UnmatchedRow
                key={p.payment_id}
                payment={p}
                onAssigned={() => setRefreshKey((k) => k + 1)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function UnmatchedRow({ payment, onAssigned }) {
  const [admissionNo, setAdmissionNo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: '1px solid #e5e7eb',
        background: 'white',
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontWeight: 950 }}>
            {formatKesFromCents(payment.amount)}{' '}
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 800 }}>
              ({payment.mpesa_receipt})
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Account reference received: <code>{payment.admission_number || '—'}</code>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 800 }}>
          {new Date(payment.transaction_time).toLocaleString()}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
        <Field label="Assign to admission number" hint="e.g. SCH-2026-000001">
          <Input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} />
        </Field>
        <Button
          disabled={busy || !admissionNo.trim()}
          onClick={() => {
            setError('');
            setBusy(true);
            try {
              assignUnmatchedPayment({
                payment_id: payment.payment_id,
                admission_number: admissionNo.trim(),
              });
              setAdmissionNo('');
              onAssigned();
            } catch (err) {
              setError(err?.message || 'Failed to assign');
            } finally {
              setBusy(false);
            }
          }}
        >
          Assign
        </Button>
      </div>

      {error && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: 10,
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

