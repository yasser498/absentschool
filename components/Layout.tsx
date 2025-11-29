
import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Home, FileText, Search, ShieldCheck, LogOut, Menu, X, Users, ClipboardCheck, BarChart2, MessageSquare, BookUser, LayoutGrid, Briefcase, ChevronLeft, ChevronRight, Settings, Sparkles, UserCircle } from 'lucide-react';
import { StaffUser } from '../types';
import { getPendingRequestsCountForStaff } from '../services/storage';

const { Link, useLocation } = ReactRouterDOM as any;

interface LayoutProps {
  children: React.ReactNode;
  role?: 'admin' | 'staff' | 'public';
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, role = 'public', onLogout }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Desktop Collapse State
  const [pendingCount, setPendingCount] = useState(0);
  const [staffPermissions, setStaffPermissions] = useState<string[]>([]);

  const isActive = (path: string) => location.pathname === path;

  const SCHOOL_LOGO = localStorage.getItem('school_logo') || "https://www.raed.net/img?id=1471924";
  const SCHOOL_NAME = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";

  // Close mobile menu when route changes
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Fetch Pending Count for Staff and Permissions
  useEffect(() => {
    if (role === 'staff') {
      const fetchStaffData = async () => {
        const session = localStorage.getItem('ozr_staff_session');
        if (session) {
          const user: StaffUser = JSON.parse(session);
          
          // Set permissions (default to basic if empty)
          setStaffPermissions(user.permissions || ['attendance', 'requests', 'reports']);

          // Only fetch count if user has requests permission
          if (!user.permissions || user.permissions.includes('requests')) {
              const count = await getPendingRequestsCountForStaff(user.assignments || []);
              setPendingCount(count);
          }
        }
      };
      fetchStaffData();
      
      // Poll every 60 seconds
      const interval = setInterval(fetchStaffData, 60000);
      return () => clearInterval(interval);
    }
  }, [role]);

  // Helper to check permission
  const hasPermission = (key: string) => staffPermissions.includes(key);

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  const NavItem = ({ to, icon: Icon, label, badge, activeColor = 'blue' }: { to: string, icon: any, label: string, badge?: number, activeColor?: string }) => (
    <Link 
      to={to} 
      className={`
        flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 font-bold relative group mb-1
        ${isActive(to) 
          ? `bg-${activeColor}-50 text-${activeColor}-900 shadow-sm` 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
        ${isSidebarCollapsed ? 'justify-center px-2' : ''}
      `}
      title={isSidebarCollapsed ? label : ''}
    >
      <Icon size={22} className={`shrink-0 transition-colors ${isActive(to) ? `text-${activeColor}-600` : 'text-slate-400 group-hover:text-slate-600'}`} />
      
      {!isSidebarCollapsed && (
        <span className="truncate">{label}</span>
      )}

      {/* Badge Logic */}
      {badge !== undefined && badge > 0 && (
        <span className={`
          absolute bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm
          ${isSidebarCollapsed 
            ? 'top-2 right-2 w-4 h-4 border-2 border-white' 
            : 'left-4 top-1/2 -translate-y-1/2 px-2 py-0.5 min-w-[20px]'}
        `}>
          {badge}
        </span>
      )}
      
      {/* Active Indicator Bar */}
      {isActive(to) && (
        <div className={`absolute right-0 top-3 bottom-3 w-1 bg-${activeColor}-600 rounded-l-full`}></div>
      )}
    </Link>
  );

  const SectionLabel = ({ label }: { label: string }) => (
    !isSidebarCollapsed ? (
      <div className="px-4 py-2 mt-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
        {label}
      </div>
    ) : <div className="my-2 border-t border-slate-100 mx-4"></div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row h-screen overflow-hidden font-sans">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b p-4 flex justify-between items-center sticky top-0 z-30 shadow-sm shrink-0 h-16">
        <div className="flex items-center gap-3 font-bold text-slate-800 text-sm">
          <img src={SCHOOL_LOGO} alt="Logo" className="w-8 h-8 object-contain" />
          <span className="text-blue-900 truncate max-w-[200px]">{SCHOOL_NAME}</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          className="text-slate-600 p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed md:relative top-0 h-full bg-white border-l border-slate-200 shadow-xl md:shadow-none z-40
        transition-all duration-300 ease-in-out flex flex-col
        ${isMobileMenuOpen ? 'translate-x-0 w-72' : 'translate-x-full md:translate-x-0'}
        ${isSidebarCollapsed ? 'md:w-24' : 'md:w-72'}
        right-0
      `}>
        {/* Mobile Close Button */}
        <div className="md:hidden p-4 flex justify-end border-b border-slate-100">
           <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 p-2">
             <X size={24} />
           </button>
        </div>

        {/* Desktop Toggle Button */}
        <button 
          onClick={toggleSidebar}
          className="hidden md:flex absolute -left-3 top-10 bg-white border border-slate-200 rounded-full p-1.5 text-slate-400 hover:text-blue-900 hover:border-blue-300 shadow-sm z-50 transition-colors"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Header Section */}
        <div className={`p-6 border-b border-slate-100 hidden md:flex flex-col items-center text-center gap-3 shrink-0 transition-all ${isSidebarCollapsed ? 'py-6 px-2' : ''}`}>
          <div className="relative">
             <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full"></div>
             <img src={SCHOOL_LOGO} alt="School Logo" className={`relative object-contain drop-shadow-sm transition-all ${isSidebarCollapsed ? 'w-10 h-10' : 'w-20 h-20'}`} />
          </div>
          {!isSidebarCollapsed && (
            <div className="animate-fade-in">
              <h1 className="font-extrabold text-blue-900 text-base leading-tight px-2">{SCHOOL_NAME}</h1>
              <p className="text-[10px] text-slate-400 font-bold mt-1 bg-slate-50 px-2 py-0.5 rounded-full inline-block">نظام الإدارة الذكي</p>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-200 pb-20 md:pb-4 space-y-1">
          
          {role === 'public' && (
            <>
              <NavItem to="/" icon={Home} label="الرئيسية" activeColor="blue" />
              <SectionLabel label="خدمات أولياء الأمور" />
              <NavItem to="/inquiry" icon={UserCircle} label="بوابة ولي الأمر" activeColor="purple" />
              <NavItem to="/submit" icon={FileText} label="تقديم عذر غياب" activeColor="emerald" />
              
              <SectionLabel label="منسوبي المدرسة" />
              <NavItem to="/staff/login" icon={Users} label="دخول المعلمين" />
              <NavItem to="/admin/login" icon={ShieldCheck} label="بوابة الإدارة" />
            </>
          )}

          {role === 'admin' && (
            <>
              <NavItem to="/admin/dashboard" icon={LayoutGrid} label="مركز القيادة" activeColor="indigo" />
              
              <SectionLabel label="العمليات اليومية" />
              <NavItem to="/admin/requests" icon={FileText} label="طلبات الأعذار" activeColor="amber" />
              <NavItem to="/admin/attendance-reports" icon={BarChart2} label="سجل الغياب اليومي" activeColor="emerald" />
              
              <SectionLabel label="التحليل والبيانات" />
              <NavItem to="/admin/attendance-stats" icon={Sparkles} label="تحليل الذكاء الاصطناعي" activeColor="purple" />
              <NavItem to="/admin/students" icon={Search} label="الطلاب والبيانات" />
              <NavItem to="/admin/users" icon={Users} label="إدارة المستخدمين" />
              
              <div className="my-4 border-t border-slate-100"></div>
              
              <button 
                onClick={onLogout}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors duration-200 font-bold shrink-0 ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="تسجيل خروج"
              >
                <LogOut size={22} className="shrink-0" />
                {!isSidebarCollapsed && <span>تسجيل خروج</span>}
              </button>
            </>
          )}

          {role === 'staff' && (
            <>
               <NavItem to="/staff/home" icon={Home} label="القائمة الرئيسية" activeColor="blue" />

               <SectionLabel label="المهام اليومية" />
               {hasPermission('attendance') && (
                 <NavItem to="/staff/attendance" icon={ClipboardCheck} label="رصد الغياب" activeColor="emerald" />
               )}
               {hasPermission('observations') && (
                 <NavItem to="/staff/observations" icon={FileText} label="ملاحظات الطلاب" activeColor="pink" />
               )}
               {hasPermission('requests') && (
                 <NavItem to="/staff/requests" icon={MessageSquare} label="طلبات الأعذار" badge={pendingCount} activeColor="amber" />
               )}

               <SectionLabel label="الإدارة والتوجيه" />
               {/* Counselor Role */}
               {hasPermission('students') && (
                 <NavItem to="/staff/students" icon={BookUser} label="مكتب الموجه الطلابي" activeColor="purple" />
               )}

               {/* Deputy Role */}
               {hasPermission('deputy') && (
                 <NavItem to="/staff/deputy" icon={Briefcase} label="مكتب وكيل الشؤون" activeColor="red" />
               )}

               <SectionLabel label="معلومات" />
               {/* Contact Directory (Teachers) */}
               {hasPermission('contact_directory') && !hasPermission('students') && (
                 <NavItem to="/staff/directory" icon={BookUser} label="دليل التواصل" />
               )}

               {hasPermission('reports') && (
                 <NavItem to="/staff/reports" icon={BarChart2} label="تقارير فصولي" />
               )}

              <div className="my-4 border-t border-slate-100"></div>
              
              <button 
                onClick={onLogout}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors duration-200 font-bold shrink-0 ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                title="تسجيل خروج"
              >
                <LogOut size={22} className="shrink-0" />
                {!isSidebarCollapsed && <span>تسجيل خروج</span>}
              </button>
            </>
          )}
        </nav>

        {/* Footer Info - Fixed at Bottom */}
        {!isSidebarCollapsed && (
          <div className="p-4 text-center text-[10px] text-slate-400 bg-slate-50/50 border-t border-slate-100 shrink-0 hidden md:block">
            <p className="font-bold">نظام عذر المدرسي</p>
            <p className="mt-0.5 truncate px-2">{SCHOOL_NAME}</p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto h-full bg-slate-50/50 relative w-full custom-scrollbar">
        <div className="max-w-7xl mx-auto pb-20 md:pb-10">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default Layout;
