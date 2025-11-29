import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Submission from './pages/Submission';
import Inquiry from './pages/Inquiry';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Requests from './pages/admin/Requests';
import Students from './pages/admin/Students';
import Users from './pages/admin/Users';
import AttendanceReports from './pages/admin/AttendanceReports';
import AttendanceStats from './pages/admin/AttendanceStats';
import StaffLogin from './pages/staff/Login';
import StaffHome from './pages/staff/Home';
import Attendance from './pages/staff/Attendance';
import StaffReports from './pages/staff/Reports';
import StaffRequests from './pages/staff/Requests';
import StaffStudents from './pages/staff/Students';
import StaffDeputy from './pages/staff/Deputy';
import StaffObservations from './pages/staff/Observations';
import { StaffUser } from './types';

const { HashRouter, Routes, Route, Navigate, useLocation } = ReactRouterDOM as any;

// Protected Route for Admin
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const session = localStorage.getItem('ozr_admin_session');
  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
};

// Protected Route for Staff with Permission Check
const ProtectedStaffRoute = ({ 
    children, 
    requiredPermission 
}: { 
    children?: React.ReactNode, 
    requiredPermission?: string 
}) => {
  const session = localStorage.getItem('ozr_staff_session');
  
  if (!session) {
    return <Navigate to="/staff/login" replace />;
  }

  if (requiredPermission) {
    const user: StaffUser = JSON.parse(session);
    const perms = user.permissions || ['attendance', 'requests', 'reports'];
    
    if (!perms.includes(requiredPermission)) {
        return <Navigate to="/staff/home" replace />;
    }
  }

  return <>{children}</>;
};

const AppContent = () => {
  const location = useLocation();
  
  // Determine Role Logic
  // Admin Route: Starts with /admin AND isn't the login page
  const isAdminRoute = location.pathname.startsWith('/admin') && location.pathname !== '/admin/login';
  
  // Staff Route: Starts with /staff AND isn't the login page
  const isStaffRoute = location.pathname.startsWith('/staff') && location.pathname !== '/staff/login';
  
  let role: 'admin' | 'staff' | 'public' = 'public';
  if (isAdminRoute) role = 'admin';
  if (isStaffRoute) role = 'staff';

  const handleLogout = () => {
    if (isAdminRoute) {
      localStorage.removeItem('ozr_admin_session');
    } else {
      localStorage.removeItem('ozr_staff_session');
    }
    // Redirect to home page completely
    window.location.href = '/'; 
  };

  return (
    <Layout role={role} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/submit" element={<Submission />} />
        <Route path="/inquiry" element={<Inquiry />} />
        
        {/* Login Pages - Now inside Layout to allow navigation back to Home */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/staff/login" element={<StaffLogin />} />
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin/attendance-stats" element={<ProtectedRoute><AttendanceStats /></ProtectedRoute>} />
        <Route path="/admin/attendance-reports" element={<ProtectedRoute><AttendanceReports /></ProtectedRoute>} />
        <Route path="/admin/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
        <Route path="/admin/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
        
        {/* Staff Routes */}
        <Route path="/staff/home" element={<ProtectedStaffRoute><StaffHome /></ProtectedStaffRoute>} />
        <Route path="/staff/attendance" element={<ProtectedStaffRoute requiredPermission="attendance"><Attendance /></ProtectedStaffRoute>} />
        <Route path="/staff/reports" element={<ProtectedStaffRoute requiredPermission="reports"><StaffReports /></ProtectedStaffRoute>} />
        <Route path="/staff/requests" element={<ProtectedStaffRoute requiredPermission="requests"><StaffRequests /></ProtectedStaffRoute>} />
        <Route path="/staff/students" element={<ProtectedStaffRoute requiredPermission="students"><StaffStudents /></ProtectedStaffRoute>} />
        <Route path="/staff/directory" element={<ProtectedStaffRoute requiredPermission="contact_directory"><StaffStudents /></ProtectedStaffRoute>} />
        <Route path="/staff/deputy" element={<ProtectedStaffRoute requiredPermission="deputy"><StaffDeputy /></ProtectedStaffRoute>} />
        <Route path="/staff/observations" element={<ProtectedStaffRoute requiredPermission="observations"><StaffObservations /></ProtectedStaffRoute>} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;