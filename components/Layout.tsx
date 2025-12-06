import React, { useEffect, useState, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Home, FileText, Search, ShieldCheck, LogOut, Menu, X, Users, ClipboardCheck, BarChart2, MessageSquare, BookUser, LayoutGrid, Briefcase, ChevronLeft, ChevronRight, Settings, Sparkles, UserCircle, ScanLine, LogOut as ExitIcon, Download, Share, BellRing, Loader2, Code, Zap } from 'lucide-react';
import { StaffUser, AppNotification } from '../types';
import { getPendingRequestsCountForStaff, getNotifications, getParentChildren, createNotification } from '../services/storage';
import ChatBot from './ChatBot';
import InstallPrompt from './InstallPrompt';
import { supabase } from '../supabaseClient';

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
  const [notificationCount, setNotificationCount] = useState(0);
  const [staffPermissions, setStaffPermissions] = useState<string[]>([]);

  // Install Logic State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Notification Permission State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  // Notification Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isActive = (path: string) => location.pathname === path;

  const SCHOOL_LOGO = localStorage.getItem('school_logo') || "https://www.raed.net/img?id=1471924";
  const SCHOOL_NAME = localStorage.getItem('school_name') || "مدرسة عماد الدين زنكي المتوسطة";

  // Close mobile menu when route changes
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Initialize Audio & Check Permissions
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Install Prompt Logic
  useEffect(() => {
    // Check if installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    // Check iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstalled(false);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', () => setIsInstalled(true));
    }
  }, []);

  const handleInstallClick = () => {
    if (isIOS) {
      alert("لتثبيت التطبيق على الآيفون:\n1. اضغط على زر المشاركة (Share) في أسفل المتصفح\n2. اختر 'إضافة إلى الصفحة الرئيسية' (Add to Home Screen)");
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
        }
      });
    } else {
        // Fallback if prompt is lost or not supported
        alert("لتثبيت التطبيق، يرجى استخدام خيار 'إضافة إلى الشاشة الرئيسية' من إعدادات المتصفح.");
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert("هذا المتصفح لا يدعم الإشعارات.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission === 'granted') {
        sendTestNotification();
    }
  };

  const sendTestNotification = () => {
      const title = "تجربة التنبيهات";
      const options = {
          body: "هذا إشعار تجريبي للتأكد من عمل النظام على جوالك.",
          icon: SCHOOL_LOGO,
          badge: SCHOOL_LOGO,
          vibrate: [200, 100, 200],
          tag: 'test-notification',
          renotify: true
      };

      if ('serviceWorker' in navigator) {
         navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, options);
         });
      } else {
          new Notification(title, options);
      }
  };

  // --- GLOBAL REALTIME NOTIFICATIONS (System Level) ---
  useEffect(() => {
    // Determine current User ID (Parent or Staff)
    const parentId = localStorage.getItem('ozr_parent_id');
    const staffSession = localStorage.getItem('ozr_staff_session');
    let userId = '';
    let childrenIds: string[] = [];

    // Helper to process a notification
    const handleNotification = (notif: AppNotification) => {
        // 1. Play Sound (if configured)
        if (audioRef.current) {
            audioRef.current.play().catch(() => {});
        }

        // 2. Trigger System Notification (The one that appears on lock screen / status bar)
        if (Notification.permission === 'granted') {
            const title = notif.title;
            const options: NotificationOptions = {
                body: notif.message,
                icon: SCHOOL_LOGO,
                badge: SCHOOL_LOGO, // Android small icon
                tag: 'school-alert-' + Date.now(), // Unique Tag to force new notification
                // @ts-ignore
                renotify: true,
                requireInteraction: true, // Keep it visible until dismissed
                data: { url: window.location.origin }, // For click handling
                // @ts-ignore
                vibrate: [200, 100, 200]
            };

            // CRITICAL: Use Service Worker for robust notifications on Android/Mobile
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(title, options);
                });
            } else {
                // Fallback for standard web (Desktop mainly)
                new Notification(title, options);
            }
        }
        
        // 3. Update Badge inside app if staff
        if (role === 'staff') {
            setNotificationCount(prev => prev + 1);
        }
    };

    const setupListener = async () => {
        if (parentId) {
            userId = parentId;
            const children = await getParentChildren(parentId);
            childrenIds = children.map(c => c.studentId);
        } else if (staffSession) {
            const user = JSON.parse(staffSession);
            userId = user.id;
        } else {
            return; // No user logged in
        }

        const watchedIds = [userId, ...childrenIds, 'ALL']; // Target User, Their Children, or Global

        // 1. REALTIME LISTENER
        const channel = supabase.channel('global_system_notifications')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                async (payload) => {
                    const newNotif = payload.new as AppNotification;
                    if (watchedIds.includes(newNotif.targetUserId)) {
                        handleNotification(newNotif);
                    }
                }
            )
            .subscribe();

        // 2. POLLING FALLBACK (Every 15 seconds)
        // This ensures notifications arrive even if Realtime disconnects
        const pollInterval = setInterval(async () => {
            if (role === 'staff') {
                const notifs = await getNotifications(userId);
                const unread = notifs.filter((n: any) => !n.isRead).length;
                setNotificationCount(unread);
            }
        }, 15000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
        };
    };

    setupListener();
  }, [role]);

  // Fetch Pending Count & Notifications for Staff
  useEffect(() => {
    if (role === 'staff') {
      const fetchStaffData = async () => {
        const session = localStorage.getItem('ozr_staff_session');
        if (session) {
          const user: StaffUser = JSON.parse(session);
          
          setStaffPermissions(user.permissions || ['attendance', 'requests', 'reports']);

          if (!user.permissions || user.permissions.includes('requests')) {
              const count = await getPendingRequestsCountForStaff(user.assignments || []);
              setPendingCount(count);
          }

          const notifs = await getNotifications(user.id);
          const unread = notifs.filter((n: any) => !n.isRead).length;
          setNotificationCount(unread);
        }
      };
      fetchStaffData();
      
      const interval = setInterval(fetchStaffData, 60000);
      return () => clearInterval(interval);
    }
  }, [role]);

  const hasPermission = (key: string) => staffPermissions.includes(key);
  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);
  const showChatBot = ['/', '/staff/home', '/admin/dashboard'].includes(location.pathname);

  const NavItem = ({ to, icon: Icon, label, badge, activeColor = 'blue' }: { to: string, icon: any, label: string, badge?: number, activeColor?: string }) => (
    <Link 
      to={to} 
      className={`
        flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-bold relative group mb-1
        ${isActive(to) 
          ? `bg-white shadow-md text-${activeColor}-600` 
          : 'text-slate-500 hover:bg-slate-100/50 hover:text-slate-900'}
        ${isSidebarCollapsed ? 'justify-center px-2' : ''}
      `}
      title={isSidebarCollapsed ? label : ''}
    >
      <Icon size={22} className={`shrink-0 transition-colors ${isActive(to) ? `text-${activeColor}-600 scale-110` : 'text-slate-400 group-hover:text-slate-600'}`} />
      
      {!isSidebarCollapsed && (
        <span className="truncate">{label}</span>
      )}

      {/* Badge Logic */}
      {badge !== undefined && badge > 0 && (
        <span className={`
          absolute bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm border border-white
          ${isSidebarCollapsed 
            ? 'top-2 right-2 w-4 h-4' 
            : 'left-4 top-1/2 -translate-y-1/2 px-2 py-0.5 min-w-[20px]'}
        `}>
          {badge}
        </span>
      )}
      
      {/* Active Indicator Bar */}
      {isActive(to) && !isSidebarCollapsed && (
        <div className={`absolute right-0 top-3 bottom-3 w-1 bg-${activeColor}-600 rounded-l-full`}></div>
      )}
    </Link>
  );

  const SectionLabel = ({ label }: { label: string }) => (
    !isSidebarCollapsed ? (
      <div className="px-4 py-2 mt-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
        <div className="h-px bg-slate-200 flex-1"></div>
        {label}
      </div>
    ) : <div className="my-2 border-t border-slate-100 mx-4"></div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row h-screen overflow-hidden font-sans">
      {/* Mobile Header */}
      <div className="md:hidden bg-white/80 backdrop-blur-md border-b p-4 flex justify-between items-center sticky top-0 z-50 shadow-sm shrink-0 h-16">
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
        fixed md:relative top-0 h-full bg-slate-50/80 backdrop-blur-xl border-l border-white/50 shadow-xl md:shadow-none z-40
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
          className="hidden md:flex absolute -left-3 top-12 bg-white border border-slate-200 rounded-full p-1.5 text-slate-400 hover:text-blue-900 hover:border-blue-300 shadow-sm z-50 transition-colors transform hover:scale-110"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Header Section */}
        <div className={`p-6 hidden md:flex flex-col items-center text-center gap-3 shrink-0 transition-all ${isSidebarCollapsed ? 'py-6 px-2' : ''}`}>
          <div className="relative group cursor-pointer">
             <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 rounded-full group-hover:opacity-30 transition-opacity"></div>
             <img src={SCHOOL_LOGO} alt="School Logo" className={`relative object-contain drop-shadow-md transition-all duration-500 ${isSidebarCollapsed ? 'w-10 h-10' : 'w-24 h-24 group-hover:scale-105'}`} />
          </div>
          {!isSidebarCollapsed && (
            <div className="animate-fade-in">
              <h1 className="font-extrabold text-slate-800 text-base leading-tight px-2">{SCHOOL_NAME}</h1>
              <div className="mt-2 inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] text-slate-500 font-bold">النظام الذكي</span>
              </div>
            </div>
          )}
        </div>

        {/* Enable Notification Button (If Permission is default/prompt) */}
        {notifPermission !== 'granted' && (
            <div className={`px-4 mb-2 animate-pulse ${isSidebarCollapsed ? 'px-2' : ''}`}>
                <button 
                    onClick={requestNotificationPermission}
                    className={`w-full bg-blue-100 text-blue-700 rounded-xl p-3 text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-200 transition-colors ${isSidebarCollapsed ? 'flex-col p-2 text-[9px]' : ''}`}
                >
                    <BellRing size={isSidebarCollapsed ? 16 : 14} />
                    {!isSidebarCollapsed && <span>تفعيل التنبيهات</span>}
                </button>
            </div>
        )}

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
               <NavItem to="/staff/home" icon={Home} label="القائمة الرئيسية" activeColor="blue" badge={notificationCount} />

               <SectionLabel label="المهام اليومية" />
               {hasPermission('gate_security') && (
                 <NavItem to="/staff/gate" icon={ScanLine} label="ماسح البوابة" activeColor="teal" />
               )}
               {hasPermission('exit_perms') && (
                 <NavItem to="/staff/exit-permissions" icon={ExitIcon} label="استئذان الطلاب" activeColor="orange" />
               )}
               {hasPermission('attendance') && (
                 <NavItem to="/staff/attendance" icon={ClipboardCheck} label="رصد الغياب" activeColor="emerald" />
               )}
               {hasPermission('observations') && (
                 <NavItem to="/staff/observations" icon={FileText} label="ملاحظات الطلاب" activeColor="pink" />
               )}
               {hasPermission('requests') && (
                 <NavItem to="/staff/requests" icon={MessageSquare} label="طلبات الأعذار" badge={pendingCount} activeColor="amber" />
               )}

               {/* Only show 'Management' label if user has permissions for it */}
               {(hasPermission('students') || hasPermission('deputy')) && (
                 <SectionLabel label="الإدارة والتوجيه" />
               )}

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

          {/* TEST NOTIFICATION BUTTON (Always Visible if installed) */}
          <div className="my-2 border-t border-slate-100 mx-4"></div>
          <button
              onClick={sendTestNotification}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-amber-600 hover:bg-amber-50 transition-colors duration-200 font-bold shrink-0 ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
              title="تجربة التنبيهات"
          >
              <Zap size={22} className="shrink-0" />
              {!isSidebarCollapsed && <span>تجربة التنبيهات</span>}
          </button>

          {/* INSTALL APP BUTTON (Visible if not installed) */}
          {!isInstalled && (
            <>
                <button
                    onClick={handleInstallClick}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 font-bold shrink-0 ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                    title="تثبيت التطبيق"
                >
                    <Download size={22} className="shrink-0" />
                    {!isSidebarCollapsed && <span>تثبيت التطبيق</span>}
                </button>
            </>
          )}
        </nav>

        {/* Footer Info - Fixed at Bottom */}
        {!isSidebarCollapsed && (
          <div className="p-4 text-center text-[10px] text-slate-400 bg-white/50 border-t border-slate-100 shrink-0 hidden md:block backdrop-blur-sm">
            <p className="font-bold">نظام عذر المدرسي v2.0</p>
            <div className="mt-1 flex items-center justify-center gap-1 opacity-70">
                <span>ياسر الهذلي</span>
                <Code size={12} />
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto h-full bg-slate-50 relative w-full custom-scrollbar">
        <div className="max-w-7xl mx-auto pb-20 md:pb-10">
          {children}
        </div>
      </main>

      {/* Chat Bot Widget - Only on Main Screens */}
      {showChatBot && <ChatBot />}
      
      {/* Install App Prompt (Popup Banner) */}
      <InstallPrompt />

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default Layout;