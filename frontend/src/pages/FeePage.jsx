import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '../components/Card.jsx';
import { Badge } from '../components/Badge.jsx';
import { Field, Input } from '../components/Field.jsx';
import { Button } from '../components/Button.jsx';
import { formatKesFromCents } from '../lib/money.js';
import { feeSummary, recordPayment } from '../mock/db.js';

export function FeePage() {
  const { admissionNumber } = useParams();
  const admission_number = decodeURIComponent(admissionNumber || '');

  const [amount, setAmount] = useState('');
  const [receipt, setReceipt] = useState('');
  const [payerName, setPayerName] = useState('');
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const summary = useMemo(() => feeSummary(admission_number), [admission_number, refreshKey]);

  if (!summary) {
    return (
      <Card title="Fee Summary" subtitle="Admission not found">
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          No admission found for <code>{admission_number}</code>. Try searching, or create a new admission.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1.1fr 0.9fr' }}>
      <Card
        title="Student Fee Page"
        subtitle={`${summary.full_name} • ${summary.course_name} • ${summary.admission_number}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>
              Enrolled on{' '}
              {summary.enrolled_at
                ? new Date(summary.enrolled_at).toLocaleDateString()
                : '—'}
            </span>
            <Badge>{summary.status}</Badge>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
              }}
            >
              <Metric label="Total fee" value={formatKesFromCents(summary.total_fee)} />
              <Metric label="Total paid" value={formatKesFromCents(summary.total_paid)} />
              <Metric label="Balance" value={formatKesFromCents(summary.balance)} />
            </div>

            {summary.status === 'CLEARED' && (
              <div style={{ marginTop: 4 }} className="no-print">
                <Link to={`/fees/${encodeURIComponent(summary.admission_number)}/receipt`}>
                  <Button variant="ghost" size="sm">
                    View printable clearance receipt
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div style={{ marginTop: 4, fontWeight: 950, color: '#111827' }}>
            Payments
          </div>

          {summary.payments.length === 0 ? (
            <div style={{ fontSize: 13, color: '#6b7280' }}>No payments yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {summary.payments.map((p) => (
                <div
                  key={p.payment_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    borderRadius: 14,
                    border: '1px solid #e5e7eb',
                    background: 'white',
                  }}
                >
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div style={{ fontWeight: 950 }}>{formatKesFromCents(p.amount)}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Receipt: {p.mpesa_receipt} • {new Date(p.transaction_time).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 800 }}>
                    {p.payer_phone || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Record payment (demo)" subtitle="Simulate an incoming M-Pesa payment.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            const amountCents = Math.round(Number(amount || 0) * 100);
            if (!amount || Number.isNaN(Number(amount)) || amountCents <= 0) {
              setError('Enter a valid amount (KES).');
              return;
            }
            if (!receipt.trim()) {
              setError('Enter a receipt (unique).');
              return;
            }
            try {
              recordPayment({
                admission_number,
                amount: amountCents,
                mpesa_receipt: receipt.trim(),
                payer_name: payerName.trim() || undefined,
                transaction_time: new Date().toISOString(),
              });
              setAmount('');
              setReceipt('');
              setPayerName('');
              setRefreshKey((k) => k + 1);
            } catch (err) {
              setError(err?.message || 'Failed to record payment');
            }
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <Field label="Amount (KES)" hint="e.g. 2000">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="M-Pesa receipt" hint="Must be unique">
            <Input value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="e.g. QAA123XYZ" />
          </Field>
          <Field label="Payer name" hint="Optional; helps with search">
            <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} />
          </Field>

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

          <div style={{ display: 'flex', gap: 10 }}>
            <Button type="submit">Record</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAmount('');
                setReceipt('');
                setError('');
              }}
            >
              Clear
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 16,
        border: '1px solid #e5e7eb',
        background: 'white',
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 950, letterSpacing: 0.2 }}>
        {value}
      </div>
    </div>
  );
}

