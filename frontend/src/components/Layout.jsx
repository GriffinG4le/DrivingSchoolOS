import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { Button } from './Button.jsx';
import { resetMockDb } from '../mock/db.js';
import { useTheme } from '../theme/ThemeProvider.jsx';

const navItems = [
  { to: '/', label: 'Home · New Admission' },
  { to: '/courses', label: 'Courses & Pricing' },
  { to: '/students/search', label: 'Student Search' },
  { to: '/payments/live', label: 'Payment Tracing' },
  { to: '/payments/unmatched', label: 'Unmatched Payments' },
  { to: '/dashboard', label: 'Dashboard (extra)' },
];

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={{ minHeight: '100vh' }}>
      <div
        style={{
          maxWidth: 1150,
          margin: '0 auto',
          padding: '18px 16px 28px',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            padding: '10px 10px 12px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                letterSpacing: 0.24,
              }}
            >
              Student Fee Tracker
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              Admin dashboard (mock data for now)
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetMockDb();
                navigate('/');
              }}
            >
              Reset demo data
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </Button>
            <a
              href="https://developer.safaricom.co.ke/"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 13, color: '#374151' }}
            >
              Daraja docs
            </a>
          </div>
        </header>

        <nav className="navbar">
          <div className="navbar-desktop">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' navbar-link--active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="navbar-mobile">
            <select
              value={
                navItems.find((n) => n.to === location.pathname)?.to ||
                navItems[0].to
              }
              onChange={(e) => navigate(e.target.value)}
            >
              {navItems.map((item) => (
                <option key={item.to} value={item.to}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </nav>

        <main style={{ paddingTop: 18 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

