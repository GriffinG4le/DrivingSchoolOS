import { useMemo, useState } from 'react';
import { Card } from '../components/Card.jsx';
import { Field, Input } from '../components/Field.jsx';
import { Button } from '../components/Button.jsx';
import { formatKesFromCents } from '../lib/money.js';
import { createCourse, getCourses } from '../mock/db.js';
import { useTheme } from '../theme/ThemeProvider.jsx';

export function CoursesPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const courses = useMemo(() => getCourses(), [refreshKey]);

  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState('');

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1.1fr 0.9fr' }}>
      <Card
        title="Courses & Pricing"
        subtitle="These courses appear in the admission dropdown with their fees."
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {courses.map((c) => (
            <div
              key={c.course_id}
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
              <div style={{ display: 'grid' }}>
                <div style={{ fontWeight: 900, color: '#111827' }}>{c.course_name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Duration: {c.duration_months || '—'} months
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 900, color: '#111827' }}>
                  {formatKesFromCents(c.fee_amount)}
                </div>
              </div>
            </div>
          ))}
          {courses.length === 0 && (
            <div style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280' }}>
              No courses yet. Add at least one, then use it during admission.
            </div>
          )}
        </div>
      </Card>

      <Card title="Add course" subtitle="For demo only (local to your browser).">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            const feeNumber = Number(fee || 0);
            if (!name.trim()) {
              setError('Course name is required.');
              return;
            }
            if (!fee || Number.isNaN(feeNumber) || feeNumber <= 0) {
              setError('Fee must be a positive number (KES).');
              return;
            }
            const durationNumber = duration ? Number(duration) : undefined;
            try {
              createCourse({
                course_name: name.trim(),
                fee_amount: Math.round(feeNumber * 100),
                duration_months:
                  duration && !Number.isNaN(durationNumber) && durationNumber > 0
                    ? durationNumber
                    : undefined,
              });
              setName('');
              setFee('');
              setDuration('');
              setRefreshKey((k) => k + 1);
            } catch (err) {
              setError(err?.message || 'Failed to create course');
            }
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <Field label="Course name" hint="e.g. Diploma in IT">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Fee (KES)" hint="e.g. 50000">
            <Input
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              inputMode="decimal"
            />
          </Field>
          <Field label="Duration (months)" hint="Optional">
            <Input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              inputMode="numeric"
            />
          </Field>

          {error && (
            <div
              style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                color: isDark ? '#fca5a5' : '#991b1b',
                padding: 10,
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}

          <Button type="submit">Save course</Button>
        </form>
      </Card>
    </div>
  );
}
