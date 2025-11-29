
import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { FileText, Search, ArrowLeft, ShieldCheck, Users, School, ArrowRight, LayoutGrid, BellRing, Megaphone, Calendar } from 'lucide-react';
import { getSchoolNews } from '../services/storage';
import { SchoolNews } from '../types';

const { Link } = ReactRouterDOM as any;

const Home: React.FC = () => {
  const [urgentNews, setUrgentNews] = useState<SchoolNews[]>([]);
  const [regularNews, setRegularNews] = useState<SchoolNews[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="space-y-12 animate-fade-in pb-10">
      
      {/* URGENT NEWS BANNER */}
      {urgentNews.length > 0 && (
        <div className="space-y-3">
          {urgentNews.map(news => (
            <div key={news.id} className="bg-red-600 text-white p-4 md:p-5 rounded-2xl shadow-lg shadow-red-600/20 flex items-start gap-4 animate-pulse-slow border border-red-500 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-10"></div>
               <div className="bg-white/20 p-2.5 rounded-xl shrink-0 backdrop-blur-sm animate-bounce-slow">
                  <BellRing size={24} className="text-white" />
               </div>
               <div className="relative z-10">
                  <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                    {news.title}
                    <span className="bg-white text-red-600 text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider">عاجل</span>
                  </h3>
                  <p className="text-red-50 text-sm leading-relaxed opacity-90">{news.content}</p>
                  <p className="text-[10px] text-red-200 mt-2 font-bold">{new Date(news.createdAt).toLocaleDateString('ar-SA')}</p>
               </div>
            </div>
          ))}
        </div>
      )}

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-2xl shadow-blue-900/20">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-30"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500 rounded-full blur-[80px] opacity-20"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-center md:text-right max-w-2xl">
                  <span className="bg-white/10 text-amber-300 border border-amber-500/30 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 inline-block">نظام الإدارة المدرسية الذكي</span>
                  <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4">
                      متوسطة عماد الدين زنكي
                      <span className="block text-blue-300 mt-2 text-2xl md:text-4xl">بوابة الخدمات الإلكترونية</span>
                  </h1>
                  <p className="text-slate-300 text-lg leading-relaxed mb-8 max-w-lg mx-auto md:mx-0">
                      منصة متكاملة لإدارة شؤون الطلاب، تقديم الأعذار، ومتابعة الأداء الدراسي والسلوكي بأحدث تقنيات الذكاء الاصطناعي.
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                      <Link to="/submit" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-blue-600/30">
                          <FileText size={20}/> تقديم عذر غياب
                      </Link>
                      <Link to="/inquiry" className="bg-white text-blue-900 px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 transition-all hover:bg-slate-50">
                          <Search size={20}/> بوابة ولي الأمر
                      </Link>
                  </div>
              </div>
              <div className="hidden md:block relative">
                  <div className="w-64 h-64 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 flex items-center justify-center p-8 rotate-3 shadow-2xl">
                      <School size={100} className="text-white/80" />
                  </div>
              </div>
          </div>
      </div>

      {/* Services Section */}
      <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <LayoutGrid className="text-blue-600"/> الخدمات الرئيسية
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/submit" className="group bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all relative overflow-hidden flex items-start gap-6">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <FileText size={32}/>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">تقديم عذر غياب</h3>
                    <p className="text-slate-500 text-sm leading-relaxed mb-4">رفع الأعذار الطبية والطارئة ومتابعة حالتها إلكترونياً دون الحاجة للحضور للمدرسة.</p>
                    <span className="text-blue-600 font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">ابدأ الخدمة <ArrowLeft size={16}/></span>
                </div>
            </Link>

            <Link to="/inquiry" className="group bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all relative overflow-hidden flex items-start gap-6">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Users size={32}/>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-amber-700 transition-colors">بوابة ولي الأمر</h3>
                    <p className="text-slate-500 text-sm leading-relaxed mb-4">لوحة تحكم شاملة لمتابعة غياب، سلوك، وملاحظات أبنائك في مكان واحد.</p>
                    <span className="text-amber-600 font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">دخول البوابة <ArrowLeft size={16}/></span>
                </div>
            </Link>
          </div>
      </div>

      {/* LATEST NEWS SECTION */}
      {regularNews.length > 0 && (
        <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Megaphone className="text-purple-600"/> أخبار المدرسة
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {regularNews.slice(0, 3).map(news => (
                    <div key={news.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="bg-purple-50 text-purple-600 p-2 rounded-lg"><Megaphone size={16}/></span>
                            <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded flex items-center gap-1">
                                <Calendar size={12}/> {new Date(news.createdAt).toLocaleDateString('ar-SA')}
                            </span>
                        </div>
                        <h3 className="font-bold text-slate-900 mb-2 line-clamp-1">{news.title}</h3>
                        <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed mb-4 flex-1">{news.content}</p>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* Staff Login Area */}
      <div className="bg-slate-900 rounded-3xl p-8 text-center md:text-right relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-slate-800 opacity-50 skew-x-12 transform origin-bottom-left"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                  <h3 className="text-2xl font-bold text-white mb-2">منسوبي المدرسة</h3>
                  <p className="text-slate-300">تسجيل دخول المعلمين والإداريين للوصول للخدمات الداخلية.</p>
              </div>
              <div className="flex gap-4">
                  <Link to="/staff/login" className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2">
                      <Users size={18}/> دخول المعلمين
                  </Link>
                  <Link to="/admin/login" className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-2">
                      <ShieldCheck size={18}/> الإدارة
                  </Link>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Home;
