import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { NewAdmission } from './pages/NewAdmission.jsx';
import { StudentSearch } from './pages/StudentSearch.jsx';
import { FeePage } from './pages/FeePage.jsx';
import { LivePayments } from './pages/LivePayments.jsx';
import { UnmatchedPayments } from './pages/UnmatchedPayments.jsx';
import { CoursesPage } from './pages/CoursesPage.jsx';
import { ReceiptPage } from './pages/ReceiptPage.jsx';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      // Home = New Admission as requested
      { path: '/', element: <NewAdmission /> },
      { path: '/admissions/new', element: <NewAdmission /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/courses', element: <CoursesPage /> },
      { path: '/students/search', element: <StudentSearch /> },
      { path: '/fees/:admissionNumber', element: <FeePage /> },
      { path: '/fees/:admissionNumber/receipt', element: <ReceiptPage /> },
      { path: '/payments/live', element: <LivePayments /> },
      { path: '/payments/unmatched', element: <UnmatchedPayments /> },
    ],
  },
]);

