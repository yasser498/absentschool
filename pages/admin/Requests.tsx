import React, { useState, useMemo, useEffect } from 'react';
import { Check, X, Eye, Calendar, Filter, MessageCircle, Sparkles, Loader2, Copy, Search, MoreHorizontal, FileText, User, RefreshCw, History, ChevronDown, ChevronUp, BrainCircuit, Send, Paperclip, School, Clock, CheckCircle, XCircle } from 'lucide-react';
import { getRequests, updateRequestStatus, invalidateCache, getStudentAttendanceHistory, generateSmartContent, sendAdminInsight } from '../../services/storage';
import { RequestStatus, ExcuseRequest, AttendanceStatus } from '../../types';

const Requests: React.FC = () => {
  const [requests, setRequests] = useState<ExcuseRequest[]>([]);
  const [filter, setFilter] = useState<RequestStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReq, setSelectedReq] = useState<ExcuseRequest | null>(null);
  const [loading, setLoading] = useState(true);
  
  // History State
  const [historyOpen, setHistoryOpen] = useState(false);
  const [studentHistory, setStudentHistory] = useState<{ date: string, status: AttendanceStatus }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // AI Logic
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [aiReply, setAiReply] = useState('');
  const [replyType, setReplyType] = useState<'accept' | 'reject' | null>(null);

  const fetchRequests = async (force = false) => {
    setLoading(true);
    try {
      const data = await getRequests(force);
      setRequests(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Calculate Counts
  const counts = useMemo(() => ({
      'ALL': requests.length,
      [RequestStatus.PENDING]: requests.filter(r => r.status === RequestStatus.PENDING).length,
      [RequestStatus.APPROVED]: requests.filter(r => r.status === RequestStatus.APPROVED).length,
      [RequestStatus.REJECTED]: requests.filter(r => r.status === RequestStatus.REJECTED).length,
  }), [requests]);

  // Fetch History when selectedReq changes
  useEffect(() => {
      if (selectedReq) {
          setLoadingHistory(true);
          getStudentAttendanceHistory(selectedReq.studentId)
              .then(setStudentHistory)
              .catch(console.error)
              .finally(() => setLoadingHistory(false));
      } else {
          setStudentHistory([]);
          setHistoryOpen(false);
      }
  }, [selectedReq]);

  const handleStatusChange = async (id: string, newStatus: RequestStatus) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    if (selectedReq && selectedReq.id === id) {
      setSelectedReq(null); 
      setAiReply('');
    }
    try {
        await updateRequestStatus(id, newStatus);
    } catch (error) {
        alert("فشل تحديث الحالة.");
        fetchRequests(true); 
    }
  };

  const generateAnalysis = async () => {
      setIsAnalyzing(true);
      try {
          const pendingCount = requests.filter(r => r.status === RequestStatus.PENDING).length;
          const topReason = "أعذار مرضية"; // Placeholder for actual calculation logic

          const prompt = `
            بصفتك مدير مدرسة، حلل طلبات الأعذار التالية:
            - إجمالي الطلبات: ${requests.length}
            - المعلقة: ${pendingCount}
            - السبب الأكثر شيوعاً: ${topReason}

            المطلوب: هل هناك نمط غير طبيعي للأعذار؟ وما التوجيه المناسب؟
          `;
          const res = await generateSmartContent(prompt);
          setAnalysisReport(res);
      } catch(e:any) {
          setAnalysisReport(e.message);
      } finally {
          setIsAnalyzing(false);
      }
  };

  const generateAiReply = async (type: 'accept' | 'reject') => {
    if (!selectedReq) return;
    setIsGeneratingReply(true);
    setReplyType(type);
    setAiReply(''); 

    try {
      const prompt = `
        اكتب رسالة نصية قصيرة (SMS) لولي أمر الطالب "${selectedReq.studentName}".
        الموضوع: رد على عذر غياب ليوم ${selectedReq.date}.
        الحالة: ${type === 'accept' ? 'تم قبول العذر' : 'تم رفض العذر'}.
        أسلوب رسمي ومختصر.
      `;
      const res = await generateSmartContent(prompt);
      setAiReply(res.trim());
    } catch (error:any) {
      setAiReply(`خطأ: ${error.message}`);
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesFilter = filter === 'ALL' ? true : r.status === filter;
      const matchesSearch = r.studentName.includes(searchTerm) || r.studentId.includes(searchTerm);
      return matchesFilter && matchesSearch;
    });
  }, [requests, filter, searchTerm]);

  const statusStyles = {
    [RequestStatus.PENDING]: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200', label: 'قيد المراجعة' },
    [RequestStatus.APPROVED]: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200', label: 'تم القبول' },
    [RequestStatus.REJECTED]: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200', label: 'مرفوض' },
  };

  // Helper function to detect image data types (URL or Base64)
  const isImage = (url: string) => {
      if (!url) return false;
      if (url.startsWith('data:image')) return true;
      return /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url);
  };

  // Filter Buttons Config
  const filterButtons = [
      { key: 'ALL', label: 'الكل', count: counts['ALL'], icon: FileText, colorClass: 'bg-blue-600 text-white', borderClass: 'border-blue-200 hover:border-blue-400' },
      { key: RequestStatus.PENDING, label: 'جديدة', count: counts[RequestStatus.PENDING], icon: Clock, colorClass: 'bg-amber-500 text-white', borderClass: 'border-amber-200 hover:border-amber-400' },
      { key: RequestStatus.APPROVED, label: 'مقبولة', count: counts[RequestStatus.APPROVED], icon: CheckCircle, colorClass: 'bg-emerald-600 text-white', borderClass: 'border-emerald-200 hover:border-emerald-400' },
      { key: RequestStatus.REJECTED, label: 'مرفوضة', count: counts[RequestStatus.REJECTED], icon: XCircle, colorClass: 'bg-red-600 text-white', borderClass: 'border-red-200 hover:border-red-400' },
  ];

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">إدارة طلبات الأعذار</h1>
            <p className="text-slate-500 mt-1 text-sm">مراجعة واتخاذ القرارات بشأن غياب الطلاب</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
             <button onClick={generateAnalysis} disabled={isAnalyzing} className="bg-purple-50 text-purple-700 px-4 py-2.5 rounded-xl hover:bg-purple-100 transition-colors font-bold text-sm flex items-center gap-2 border border-purple-100">
                 {isAnalyzing ? <Loader2 className="animate-spin" size={18}/> : <BrainCircuit size={18}/>} تحليل الطلبات
             </button>
             <div className="flex gap-2 w-full">
               <button onClick={() => fetchRequests(true)} className="bg-slate-100 text-slate-600 p-3 rounded-xl hover:bg-slate-200 transition-colors" title="تحديث"><RefreshCw size={20} className={loading ? 'animate-spin' : ''}/></button>
               <div className="relative w-full md:w-80">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="بحث بالاسم أو الهوية..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 outline-none text-sm transition-all"/>
               </div>
             </div>
          </div>
        </div>

        {/* Filters Grid (New Design) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filterButtons.map((btn) => {
                const isActive = filter === btn.key;
                return (
                    <button
                        key={btn.key}
                        onClick={() => setFilter(btn.key as any)}
                        className={`
                            relative p-4 rounded-xl border-2 transition-all flex flex-col items-start justify-between gap-4 h-28 overflow-hidden group
                            ${isActive ? `${btn.colorClass} border-transparent shadow-lg transform scale-[1.02]` : `bg-white text-slate-600 ${btn.borderClass} hover:shadow-md`}
                        `}
                    >
                        <div className="flex justify-between w-full items-start relative z-10">
                            <span className={`text-sm font-bold ${isActive ? 'text-white/90' : 'text-slate-500'}`}>{btn.label}</span>
                            <btn.icon size={20} className={isActive ? 'text-white' : 'text-slate-400'} />
                        </div>
                        <span className={`text-3xl font-extrabold relative z-10 ${isActive ? 'text-white' : 'text-slate-800'}`}>
                            {btn.count}
                        </span>
                        
                        {/* Background Decor */}
                        <btn.icon 
                            size={80} 
                            className={`absolute -bottom-4 -left-4 transition-transform duration-500 
                                ${isActive ? 'text-white opacity-20 rotate-12 scale-110' : 'text-slate-100 opacity-0 group-hover:opacity-100 rotate-0'}
                            `} 
                        />
                    </button>
                );
            })}
        </div>
      </div>

      {/* Analysis Panel */}
      {analysisReport && (
        <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl animate-fade-in relative">
            <button onClick={() => setAnalysisReport(null)} className="absolute top-2 left-2 text-purple-400"><X size={16}/></button>
            <h4 className="font-bold text-purple-800 mb-2 flex items-center gap-2"><Sparkles size={16}/> تحليل الذكاء الاصطناعي</h4>
            <p className="text-sm text-purple-700 leading-relaxed whitespace-pre-line">{analysisReport}</p>
        </div>
      )}

      {/* Requests Grid (Aesthetic Cards) */}
      {loading ? (
          <div className="py-20 text-center text-slate-400"><Loader2 className="mx-auto mb-4 animate-spin" size={32} /><p>جاري التحميل...</p></div>
      ) : filteredRequests.length === 0 ? (
          <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><FileText className="mx-auto mb-4 opacity-50" size={48} /><p className="font-bold">لا توجد طلبات</p></div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRequests.map(req => (
                  <div key={req.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden group flex flex-col">
                      <div className="p-4 border-b border-slate-50 flex justify-between items-start bg-slate-50/50">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-blue-700 flex items-center justify-center font-bold text-sm shadow-sm">
                                  {req.studentName.charAt(0)}
                              </div>
                              <div>
                                  <h3 className="font-bold text-slate-800 text-sm truncate max-w-[140px]">{req.studentName}</h3>
                                  <p className="text-[10px] text-slate-500 font-mono">{req.studentId}</p>
                              </div>
                          </div>
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${statusStyles[req.status].bg} ${statusStyles[req.status].text} ${statusStyles[req.status].border}`}>
                              {statusStyles[req.status].label}
                          </span>
                      </div>
                      <div className="p-5 flex-1 space-y-4">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                              <span className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200">
                                  <School size={12} className="text-slate-400"/> {req.grade} - {req.className}
                              </span>
                              <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-100">
                                  <Calendar size={12} /> {req.date}
                              </span>
                          </div>
                          <div>
                              <p className="text-sm font-bold text-slate-800 mb-1">{req.reason}</p>
                              <p className="text-xs text-slate-500 line-clamp-2">{req.details || 'لا توجد تفاصيل إضافية.'}</p>
                          </div>
                          {req.attachmentName && (
                              <div className="flex items-center gap-1.5 text-[10px] text-blue-600 font-bold bg-blue-50/50 w-fit px-2.5 py-1.5 rounded-lg border border-blue-100">
                                  <Paperclip size={12} /> <span className="truncate max-w-[150px]">{req.attachmentName}</span>
                              </div>
                          )}
                      </div>
                      <div className="p-3 bg-slate-50/50 border-t border-slate-50 mt-auto">
                          <button onClick={() => setSelectedReq(req)} className="w-full bg-white border border-slate-200 text-slate-600 hover:text-blue-900 hover:border-blue-300 py-2 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2">
                              <Eye size={16} /> معاينة
                          </button>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* Detail Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up border border-slate-200 flex flex-col max-h-[95vh]">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                 <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-900"><User size={20} /></div>
                    <div><h3 className="font-bold text-slate-900 text-lg">تفاصيل العذر</h3><p className="text-xs text-slate-500">#{selectedReq.id.slice(-6)}</p></div>
                 </div>
                 <button onClick={() => setSelectedReq(null)} className="text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 p-2 rounded-full transition-colors"><X size={20} /></button>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto">
                 {/* Basic Info Grid */}
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">الطالب</label><p className="font-bold text-slate-800 text-sm">{selectedReq.studentName}</p></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">الصف</label><p className="font-bold text-slate-800 text-sm">{selectedReq.grade} - {selectedReq.className}</p></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">تاريخ الغياب</label><p className="font-mono text-blue-900 text-sm font-bold">{selectedReq.date}</p></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">الحالة</label><span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${statusStyles[selectedReq.status].bg} ${statusStyles[selectedReq.status].text}`}>{statusStyles[selectedReq.status].label}</span></div>
                 </div>

                 {/* Attendance History (Collapsible) */}
                 <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button onClick={() => setHistoryOpen(!historyOpen)} className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-bold text-slate-700">
                        <div className="flex items-center gap-2"><History size={16} className="text-slate-400"/> سجل الحضور والغياب</div>
                        {historyOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                    {historyOpen && (
                        <div className="p-3 bg-white max-h-48 overflow-y-auto custom-scrollbar border-t border-slate-200">
                            {loadingHistory ? <div className="flex justify-center p-4"><Loader2 size={20} className="animate-spin text-slate-400"/></div> : studentHistory.length > 0 ? (
                                <div className="space-y-1">
                                    {studentHistory.map((rec, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs p-2 rounded hover:bg-slate-50 border-b border-slate-50 last:border-0">
                                            <span className="text-slate-600 font-mono">{rec.date}</span>
                                            <span className={`px-2 py-0.5 rounded font-bold ${rec.status === AttendanceStatus.ABSENT ? 'bg-red-50 text-red-600' : rec.status === AttendanceStatus.LATE ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {rec.status === AttendanceStatus.ABSENT ? 'غائب' : rec.status === AttendanceStatus.LATE ? 'متأخر' : 'حاضر'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-center text-xs text-slate-400 py-4">لا يوجد سجلات سابقة</p>}
                        </div>
                    )}
                 </div>

                 {/* Reason & Details */}
                 <div className="bg-white border border-slate-200 p-4 rounded-xl">
                    <h4 className="font-bold text-slate-800 mb-2 text-sm flex items-center gap-2"><FileText size={16} className="text-blue-500"/> سبب الغياب: {selectedReq.reason}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">{selectedReq.details || 'لا توجد تفاصيل إضافية.'}</p>
                 </div>

                 {/* Attachment */}
                 <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-2">المرفقات</label>
                    {selectedReq.attachmentUrl ? (
                        <div>
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-100 bg-blue-50 text-blue-900 font-bold text-sm">
                                <div className="bg-white p-2 rounded-lg text-blue-500 shadow-sm"><FileText size={18} /></div>
                                <div className="flex-1 min-w-0">
                                    <a href={selectedReq.attachmentUrl} target="_blank" rel="noreferrer" className="hover:underline truncate block">
                                        {selectedReq.attachmentName || 'عرض الملف'}
                                    </a>
                                </div>
                            </div>
                            
                            {isImage(selectedReq.attachmentUrl) && (
                               <div className="mt-3 relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                                   <img src={selectedReq.attachmentUrl} alt="Attachment Preview" className="w-full h-auto max-h-64 object-contain" />
                                   <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => window.open(selectedReq.attachmentUrl, '_blank')}>
                                       <span className="text-white font-bold flex items-center gap-2"><Eye size={20} /> تكبير الصورة</span>
                                   </div>
                               </div>
                            )}
                        </div>
                    ) : <div className="text-sm text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200">لا يوجد مرفقات</div>}
                 </div>

                 {/* AI Reply */}
                 <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500 opacity-10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2"></div>
                       <div className="relative z-10">
                          <div className="flex items-center gap-2 mb-4"><Sparkles size={16} className="text-amber-400" /><span className="font-bold text-sm">الرد الذكي (AI Reply)</span></div>
                          {aiReply ? (
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-3 animate-fade-in mb-3">
                                <p className="text-xs text-amber-300 font-bold mb-1 opacity-80">نص الرسالة المقترح:</p>
                                <p className="text-sm leading-relaxed font-light">{aiReply}</p>
                                <button onClick={() => navigator.clipboard.writeText(aiReply)} className="mt-2 text-xs flex items-center gap-1.5 text-white hover:text-amber-300 transition-colors"><Copy size={12} /> نسخ النص</button>
                            </div>
                          ) : <p className="text-xs text-blue-200 mb-4 opacity-80">توليد رد رسمي لولي الأمر.</p>}
                          <div className="flex gap-2">
                             <button onClick={() => generateAiReply('accept')} disabled={isGeneratingReply} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2.5 px-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 border border-emerald-400/30">{isGeneratingReply && replyType === 'accept' ? <Loader2 size={12} className="animate-spin" /> : <Check size={14} />} رد قبول</button>
                             <button onClick={() => generateAiReply('reject')} disabled={isGeneratingReply} className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs py-2.5 px-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 border border-white/10">{isGeneratingReply && replyType === 'reject' ? <Loader2 size={12} className="animate-spin" /> : <X size={14} />} رد رفض</button>
                          </div>
                       </div>
                 </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10 flex gap-3">
                 <button onClick={() => handleStatusChange(selectedReq.id, RequestStatus.APPROVED)} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 active:scale-95"><Check size={18} /> اعتماد</button>
                 <button onClick={() => handleStatusChange(selectedReq.id, RequestStatus.REJECTED)} className="flex-1 bg-white border-2 border-red-100 text-red-600 py-3 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 active:scale-95"><X size={18} /> رفض</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Requests;