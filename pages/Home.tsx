
import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { FileText, Search, ArrowLeft, ShieldCheck, Users, School, Megaphone, Calendar, ChevronLeft, Bell, LayoutGrid, LogIn } from 'lucide-react';
import { getSchoolNews } from '../services/storage';
import { SchoolNews } from '../types';

const { Link } = ReactRouterDOM as any;

const Home: React.FC = () => {
  const [urgentNews, setUrgentNews] = useState<SchoolNews[]>([]);
  const [regularNews, setRegularNews] = useState<SchoolNews[]>([]);
  const [loading, setLoading] = useState(true);

  const SCHOOL_NAME = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";
  const SCHOOL_LOGO = localStorage.getItem('school_logo') || "https://www.raed.net/img?id=1471924";

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const data = await getSchoolNews();
        setUrgentNews(data.filter(n => n.isUrgent));
        setRegularNews(data.filter(n => !n.isUrgent));
      } catch (e) {
        console.error("Failed to load news");
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* 1. HERO SECTION */}
      <div className="relative bg-blue-900 text-white overflow-hidden rounded-b-[3rem] shadow-2xl">
          {/* Background Effects */}
          <div className="absolute inset-0">
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-blob"></div>
             <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-purple-600 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-blob animation-delay-2000"></div>
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          </div>

          <div className="relative max-w-7xl mx-auto px-6 pt-12 pb-24 md:pt-20 md:pb-32 flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="text-center md:text-right max-w-2xl space-y-6">
                  <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 text-xs font-bold text-blue-100 mb-2">
                      <School size={14} />
                      <span>نظام الإدارة المدرسية الذكي</span>
                  </div>
                  <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
                      مرحباً بكم في <br/>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">{SCHOOL_NAME}</span>
                  </h1>
                  <p className="text-lg text-blue-100 leading-relaxed max-w-lg mx-auto md:mx-0 opacity-90">
                      منصة رقمية متكاملة تهدف إلى تعزيز التواصل بين المدرسة والمنزل، وتوفير بيئة تعليمية ذكية ومتطورة.
                  </p>
                  
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start pt-4">
                      <Link to="/inquiry" className="group bg-white text-blue-900 px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all hover:bg-blue-50 hover:scale-105 shadow-lg shadow-blue-900/20">
                          <Search size={20} className="text-blue-600"/>
                          <span>بوابة ولي الأمر</span>
                          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform opacity-50"/>
                      </Link>
                      <Link to="/submit" className="group bg-white/10 text-white border border-white/20 px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all hover:bg-white/20 backdrop-blur-sm">
                          <FileText size={20}/>
                          <span>تقديم عذر غياب</span>
                      </Link>
                  </div>
              </div>

              {/* Hero Image / Logo */}
              <div className="relative hidden md:block">
                  <div className="w-80 h-80 bg-white/10 backdrop-blur-xl rounded-[2rem] border border-white/20 flex items-center justify-center shadow-2xl rotate-3 hover:rotate-0 transition-all duration-500 group">
                      <img src={SCHOOL_LOGO} alt="Logo" className="w-48 h-48 object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce-slow">
                      <div className="bg-green-100 p-2 rounded-full text-green-600"><ShieldCheck size={24}/></div>
                      <div>
                          <p className="text-xs text-slate-400 font-bold">حالة النظام</p>
                          <p className="text-sm font-bold text-slate-800">يعمل بكفاءة</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* 2. ALERTS & NEWS TICKER */}
      <div className="max-w-7xl mx-auto px-6 -mt-10 relative z-20 space-y-4">
          {urgentNews.map(news => (
            <div key={news.id} className="bg-red-600 text-white p-4 rounded-xl shadow-lg flex items-center gap-4 animate-pulse-slow">
               <span className="bg-white/20 p-2 rounded-lg"><Bell size={20}/></span>
               <div className="flex-1">
                  <span className="bg-white text-red-600 text-[10px] px-2 py-0.5 rounded font-bold ml-2">عاجل</span>
                  <span className="font-bold text-sm">{news.title}:</span> <span className="text-sm opacity-90">{news.content}</span>
               </div>
            </div>
          ))}
      </div>

      {/* 3. PORTALS GRID */}
      <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-8">
              <div className="w-1 h-8 bg-blue-600 rounded-full"></div>
              <h2 className="text-2xl font-bold text-slate-800">الخدمات الإلكترونية</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Parent Portal */}
              <Link to="/inquiry" className="group relative bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-xl border border-slate-100 transition-all duration-300 overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                  <div className="relative z-10">
                      <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:rotate-12 transition-transform">
                          <Users size={32}/>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">بوابة أولياء الأمور</h3>
                      <p className="text-slate-500 text-sm leading-relaxed mb-6">
                          تابع حضور وغياب أبنائك، اطلع على التقارير السلوكية، وتواصل مع إدارة المدرسة بسهولة.
                      </p>
                      <span className="inline-flex items-center gap-2 text-purple-600 font-bold text-sm group-hover:gap-3 transition-all">
                          دخول البوابة <ArrowLeft size={16}/>
                      </span>
                  </div>
              </Link>

              {/* Staff Portal */}
              <Link to="/staff/login" className="group relative bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-xl border border-slate-100 transition-all duration-300 overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                  <div className="relative z-10">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:rotate-12 transition-transform">
                          <Briefcase size={32}/>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">بوابة المعلمين</h3>
                      <p className="text-slate-500 text-sm leading-relaxed mb-6">
                          رصد الحضور، إدارة السلوك، متابعة الإحالات، والتواصل المباشر مع الوكلاء والمرشدين.
                      </p>
                      <span className="inline-flex items-center gap-2 text-emerald-600 font-bold text-sm group-hover:gap-3 transition-all">
                          تسجيل الدخول <ArrowLeft size={16}/>
                      </span>
                  </div>
              </Link>

              {/* Admin Portal */}
              <Link to="/admin/login" className="group relative bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-xl border border-slate-100 transition-all duration-300 overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                  <div className="relative z-10">
                      <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:rotate-12 transition-transform">
                          <ShieldCheck size={32}/>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">الإدارة المدرسية</h3>
                      <p className="text-slate-500 text-sm leading-relaxed mb-6">
                          لوحة تحكم شاملة للمدير والوكلاء لإدارة النظام، التقارير، الإحصائيات، والمستخدمين.
                      </p>
                      <span className="inline-flex items-center gap-2 text-blue-600 font-bold text-sm group-hover:gap-3 transition-all">
                          لوحة التحكم <ArrowLeft size={16}/>
                      </span>
                  </div>
              </Link>
          </div>
      </div>

      {/* 4. SCHOOL NEWS GRID */}
      {regularNews.length > 0 && (
          <div className="bg-slate-100 py-16">
              <div className="max-w-7xl mx-auto px-6">
                  <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                          <div className="w-1 h-8 bg-slate-800 rounded-full"></div>
                          <h2 className="text-2xl font-bold text-slate-800">أخبار وإعلانات المدرسة</h2>
                      </div>
                      <span className="text-slate-500 text-sm font-bold bg-white px-4 py-2 rounded-full shadow-sm">آخر التحديثات</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {regularNews.slice(0, 4).map(news => (
                          <div key={news.id} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col h-full border border-slate-200">
                              <div className="flex items-center gap-2 mb-4">
                                  <span className="bg-blue-50 text-blue-600 p-2 rounded-lg"><Megaphone size={16}/></span>
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                                      {new Date(news.createdAt).toLocaleDateString('ar-SA')}
                                  </span>
                              </div>
                              <h3 className="font-bold text-slate-900 mb-2 line-clamp-2">{news.title}</h3>
                              <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-4 flex-1">
                                  {news.content}
                              </p>
                              <div className="pt-4 border-t border-slate-50 mt-auto">
                                  <span className="text-xs font-bold text-blue-600 flex items-center gap-1 cursor-pointer hover:underline">
                                      اقرأ المزيد <ChevronLeft size={14}/>
                                  </span>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12 mt-12">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                  <img src={SCHOOL_LOGO} alt="Logo" className="w-12 h-12 object-contain opacity-80" />
                  <div>
                      <p className="font-bold text-slate-800">{SCHOOL_NAME}</p>
                      <p className="text-xs text-slate-500">جميع الحقوق محفوظة © {new Date().getFullYear()}</p>
                  </div>
              </div>
              <div className="flex gap-6 text-sm font-bold text-slate-500">
                  <Link to="/" className="hover:text-blue-600 transition-colors">الرئيسية</Link>
                  <Link to="/staff/login" className="hover:text-blue-600 transition-colors">دخول الموظفين</Link>
                  <Link to="/admin/login" className="hover:text-blue-600 transition-colors">الإدارة</Link>
              </div>
          </div>
      </footer>
    </div>
  );
};

// Icon import helper
import { Briefcase } from 'lucide-react';

export default Home;
