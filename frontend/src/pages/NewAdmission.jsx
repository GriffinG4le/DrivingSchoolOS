import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card.jsx';
import { Field, Input, Select } from '../components/Field.jsx';
import { Button } from '../components/Button.jsx';
import { formatKesFromCents } from '../lib/money.js';
import { createAdmission, getCourses } from '../mock/db.js';
import { useTheme } from '../theme/ThemeProvider.jsx';

export function NewAdmission() {
  const navigate = useNavigate();
  const courses = useMemo(() => getCourses(), []);

  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [courseId, setCourseId] = useState(courses[0]?.course_id ? String(courses[0].course_id) : '');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const selectedCourse = courses.find((c) => String(c.course_id) === String(courseId));

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1.1fr 0.9fr' }}>
      <Card
        title="New Admission"
        subtitle="Enroll a student and generate an admission number (used as M-Pesa account reference)."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            try {
              const created = createAdmission({
                full_name: fullName.trim(),
                national_id: nationalId.trim(),
                phone: phone.trim(),
                course_id: courseId,
              });
              setResult(created);
            } catch (err) {
              setError(err?.message || 'Failed to create admission');
            }
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <Field label="Full name" hint="Required">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Jane Wanjiku" />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="National ID / Birth cert" hint="Optional">
              <Input value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="e.g. 12345678" />
            </Field>
            <Field label="Phone" hint="Optional">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +2547..." />
            </Field>
          </div>

          <Field label="Course" hint="Required">
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>
                  {c.course_name} — {formatKesFromCents(c.fee_amount)}
                </option>
              ))}
            </Select>
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

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button type="submit" disabled={!fullName.trim() || !courseId}>
              Create admission
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setFullName('');
                setNationalId('');
                setPhone('');
                setError('');
                setResult(null);
              }}
            >
              Clear
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Preview" subtitle="What staff will hand to the student.">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280' }}>
            Course fee:
          </div>
          <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: 0.2, color: isDark ? '#f3f4f6' : '#111827' }}>
            {selectedCourse ? formatKesFromCents(selectedCourse.fee_amount) : '—'}
          </div>

          {result ? (
            <div
              style={{
                marginTop: 6,
                padding: 12,
                borderRadius: 16,
                border: '1px solid #dbeafe',
                background: 'rgba(219,234,254,0.35)',
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 800 }}>
                Admission number (account reference)
              </div>
              <div style={{ fontSize: 20, fontWeight: 950, color: '#111827' }}>
                {result.admission.admission_number}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Paybill: {result.payment_instructions.paybill}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                <Button
                  size="sm"
                  onClick={() => {
                    navigate(`/fees/${encodeURIComponent(result.admission.admission_number)}`);
                  }}
                >
                  Open fee page
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await navigator.clipboard.writeText(result.admission.admission_number);
                  }}
                >
                  Copy admission no.
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280' }}>
              Create an admission to generate a real admission number.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
