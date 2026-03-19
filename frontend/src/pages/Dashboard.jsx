import { Link } from 'react-router-dom';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/Button.jsx';
import { Badge } from '../components/Badge.jsx';
import { formatKesFromCents } from '../lib/money.js';
import { getCourses, livePaymentFeed } from '../mock/db.js';
import { useTheme } from '../theme/ThemeProvider.jsx';

export function Dashboard() {
  const courses = getCourses();
  const payments = livePaymentFeed({ limit: 8 });

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: 14,
        }}
      >
        <Card
          title="Quick actions"
          subtitle="Start with enrollment, then track fee status by admission number."
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/admissions/new">
              <Button>New Admission</Button>
            </Link>
            <Link to="/students/search">
              <Button variant="ghost">Student Search</Button>
            </Link>
            <Link to="/payments/live">
              <Button variant="ghost">Live Payments</Button>
            </Link>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280' }}>
            For now this frontend uses mock data (stored in your browser). Later we’ll replace the mock
            functions with real API calls to your backend.
          </div>
        </Card>

        <Card title="Courses" subtitle="Fees auto-fill at admission time.">
          <div style={{ display: 'grid', gap: 10 }}>
            {courses.map((c) => (
              <div
                key={c.course_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
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
          </div>
        </Card>
      </div>

      <Card
        title="Recent payments"
        subtitle="This will become the real-time feed from M-Pesa callbacks."
        actions={
          <Link to="/payments/live">
            <Button size="sm" variant="ghost">
              View all
            </Button>
          </Link>
        }
      >
        {payments.length === 0 ? (
          <div style={{ color: isDark ? '#9ca3af' : '#6b7280', fontSize: 13 }}>
            No payments yet. Create an admission, then record a mock payment.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {payments.map((p) => (
              <div
                key={p.payment_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: 12,
                  borderRadius: 14,
                  border: '1px solid #e5e7eb',
                  background: 'white',
                }}
              >
                <div style={{ display: 'grid' }}>
                    <div style={{ fontWeight: 900, color: '#111827' }}>
                    {formatKesFromCents(p.amount)}{' '}
                      <span style={{ color: '#6b7280', fontWeight: 700, fontSize: 12 }}>
                      ({p.mpesa_receipt})
                    </span>
                  </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Admission: {p.admission_number}
                  </div>
                </div>
                <Badge>RECORDED</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
