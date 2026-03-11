import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card.jsx';
import { Field, Input } from '../components/Field.jsx';
import { Badge } from '../components/Badge.jsx';
import { formatKesFromCents } from '../lib/money.js';
import { searchAdmissions } from '../mock/db.js';

export function StudentSearch() {
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchAdmissions(query), [query]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card
        title="Student Search"
        subtitle="Search by name, phone, national ID, or admission number."
      >
        <Field label="Search">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
          />
        </Field>
      </Card>

      <Card
        title="Results"
        subtitle={query.trim() ? `${results.length} match(es)` : 'Start typing to search'}
      >
        {results.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            {query.trim()
              ? 'No matches. Try admission number or phone.'
              : 'Tip: try “SCH-”, a name, or a phone number.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {results.map((r) => (
              <div
                key={r.admission_number}
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
                  <div style={{ fontWeight: 950 }}>
                    {r.full_name}{' '}
                    <span style={{ color: '#6b7280', fontWeight: 800, fontSize: 12 }}>
                      ({r.admission_number})
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {r.course_name} • Fee: {formatKesFromCents(r.fee_amount_snapshot)} •{' '}
                    {r.phone || 'No phone'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Badge>{r.status}</Badge>
                  <Link
                    to={`/fees/${encodeURIComponent(r.admission_number)}`}
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      color: '#2563eb',
                      padding: '8px 10px',
                      borderRadius: 12,
                      border: '1px solid #dbeafe',
                      background: 'rgba(219,234,254,0.35)',
                    }}
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

