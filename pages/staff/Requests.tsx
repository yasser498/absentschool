import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Check, X, Eye, Calendar, Search, User, FileText, RefreshCw, Loader2, MessageCircle, School, Paperclip, History, ChevronDown, ChevronUp } from 'lucide-react';
import { getRequests, updateRequestStatus, getStudentAttendanceHistory } from '../../services/storage';
import { RequestStatus, ExcuseRequest, StaffUser, AttendanceStatus } from '../../types';

const { useNavigate } = ReactRouterDOM as any;

const StaffRequests: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [requests, setRequests] = useState<ExcuseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReq, setSelectedReq] = useState<ExcuseRequest | null>(null);
  const [filter, setFilter] = useState<RequestStatus | 'ALL'>('ALL');

  // History State
  const [historyOpen, setHistoryOpen] = useState(false);
  const [studentHistory, setStudentHistory] = useState<{ date: string, status: AttendanceStatus }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (!session) {
      navigate('/staff/login');
      return;
    }
    setCurrentUser(JSON.parse(session));
  }, [navigate]);

  const fetchRequests = async (force = false) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const allRequests = await getRequests(force);
      
      // Filter requests for students in classes assigned to this staff member
      const assignedClasses = currentUser.assignments || [];
      const myRequests = allRequests.filter(req => 
        assignedClasses.some(a => a.grade === req.grade && a.className === req.className)
      );
      
      setRequests(myRequests);
    } catch (e) {
      console.error("Error fetching requests:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [currentUser]);

  // Fetch History when selectedReq changes
  useEffect(() => {
    if (selectedReq) {
      setLoadingHistory(true);
      getStudentAttendanceHistory(selectedReq.studentId, selectedReq.grade, selectedReq.className)
        .then(setStudentHistory)
        .catch(e => console.error(e))
        .finally(() => setLoadingHistory(false));
    }
  }, [selectedReq]);

  const handleStatusChange = async (id: string, newStatus: RequestStatus) => {
    // Optimistic update
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    
    if (selectedReq && selectedReq.id === id) {
      setSelectedReq(null);
    }

    try {
      await updateRequestStatus(id, newStatus);
    } catch (error) {
      alert("فشل تحديث الحالة، يرجى المحاولة مرة أخرى.");
      fetchRequests(true); // Revert
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesFilter = filter === 'ALL' ? true : r.status === filter;
      const matchesSearch = r.studentName.includes(searchTerm) || r.studentId.includes(searchTerm);
      return matchesFilter && matchesSearch;
    });
  }, [requests, filter, searchTerm]);

  // Counts for Tabs
  const counts = useMemo(() => {
    return {
      ALL: requests.length,
      [RequestStatus.PENDING]: requests.filter(r => r.status === RequestStatus.PENDING).length,
      [RequestStatus.APPROVED]: requests.filter(r => r.status === RequestStatus.APPROVED).length,
      [RequestStatus.REJECTED]: requests.filter(r => r.status === RequestStatus.REJECTED).length,
    };
  }, [requests]);

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
  
  if (!currentUser) return null;

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* Header & Controls */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
               <MessageCircle className="text-amber-500" /> طلبات الأعذار (فصولي)
            </h1>
            <p className="text-slate-500 mt-1">مراجعة أعذار الطلاب في الفصول المسندة إليك</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
             <button 
               onClick={() => fetchRequests(true)}
               className="bg-slate-100 text-slate-600 p-2.5 rounded-xl hover:bg-slate-200 transition-colors shrink-0"
               title="تحديث القائمة"
             >
               <RefreshCw size={20} className={loading ? 'animate-spin' : ''}/>
             </button>
             <div className="relative w-full md:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="بحث بالطالب..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 outline-none text-sm"
                />
             </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 overflow-x-auto pb-1">
          {(['ALL', RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.REJECTED] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2
                ${filter === f ? 'bg-blue-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}
              `}
            >
              {f === 'ALL' ? 'الكل' : f === RequestStatus.PENDING ? 'جديدة' : f === RequestStatus.APPROVED ? 'مقبولة' : 'مرفوضة'}
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${filter === f ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {f === 'ALL' ? requests.length : requests.filter(r => r.status === f).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Requests Grid */}
      {loading ? (
         <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
             <Loader2 className="mx-auto mb-4 animate-spin" size={32} />
             <p className="font-bold">جاري جلب الطلبات...</p>
         </div>
      ) : filteredRequests.length === 0 ? (
         <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
             <FileText className="mx-auto mb-4 opacity-50" size={48} />
             <p className="font-bold text-lg">لا توجد طلبات مطابقة</p>
         </div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRequests.map(req => (
               <div key={req.id} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden hover:-translate-y-1">
                  {/* Card Header */}
                  <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-blue-700 flex items-center justify-center font-bold text-sm shadow-sm">
                              {req.studentName.charAt(0)}
                          </div>
                          <div>
                              <h3 className="font-bold text-slate-800 text-sm truncate max-w-[120px]">{req.studentName}</h3>
                              <p className="text-[10px] text-slate-500 font-mono">{req.studentId}</p>
                          </div>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${statusStyles[req.status].bg} ${statusStyles[req.status].text} ${statusStyles[req.status].border}`}>
                          {statusStyles[req.status].label}
                      </span>
                  </div>

                  {/* Card Body */}
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
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                             {req.details || 'لا توجد تفاصيل إضافية.'}
                          </p>
                      </div>

                      {req.attachmentName && (
                          <div className="flex items-center gap-1.5 text-[10px] text-blue-600 font-bold bg-blue-50/50 w-fit px-2.5 py-1.5 rounded-lg border border-blue-100">
                              <Paperclip size={12} /> 
                              <span className="truncate max-w-[150px]">{req.attachmentName}</span>
                          </div>
                      )}
                  </div>

                  {/* Card Footer */}
                  <div className="p-4 border-t border-slate-50 bg-slate-50/30 mt-auto">
                      <button 
                          onClick={() => setSelectedReq(req)}
                          className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-900 hover:border-blue-300 hover:bg-blue-50 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm group-hover:shadow"
                      >
                          <Eye size={16} /> معاينة واتخاذ قرار
                      </button>
                  </div>
               </div>
            ))}
         </div>
      )}

      {/* Detail Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up border border-slate-200 flex flex-col max-h-[95vh]">
              
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                 <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-900">
                        <User size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg">تفاصيل العذر</h3>
                        <p className="text-xs text-slate-500">#{selectedReq.id.slice(-6)}</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedReq(null)} className="text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 p-2 rounded-full transition-colors">
                    <X size={20} />
                 </button>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto">
                 {/* Student Info */}
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">الطالب</label>
                       <p className="font-bold text-slate-800 text-sm">{selectedReq.studentName}</p>
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">الصف</label>
                       <p className="font-bold text-slate-800 text-sm">{selectedReq.grade} - {selectedReq.className}</p>
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">تاريخ الغياب</label>
                       <p className="font-mono text-blue-900 text-sm font-bold">{selectedReq.date}</p>
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">الحالة الحالية</label>
                       <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${statusStyles[selectedReq.status].bg} ${statusStyles[selectedReq.status].text}`}>
                          {statusStyles[selectedReq.status].label}
                       </span>
                    </div>
                 </div>

                 {/* New Collapsible Section for Attendance History */}
                 <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button 
                        onClick={() => setHistoryOpen(!historyOpen)}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-bold text-slate-700"
                    >
                        <div className="flex items-center gap-2">
                            <History size={16} className="text-slate-400"/>
                            سجل الحضور والغياب
                        </div>
                        {historyOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                    
                    {historyOpen && (
                        <div className="p-3 bg-white max-h-48 overflow-y-auto custom-scrollbar border-t border-slate-200">
                            {loadingHistory ? (
                                <div className="flex justify-center p-4"><Loader2 size={20} className="animate-spin text-slate-400"/></div>
                            ) : studentHistory.length > 0 ? (
                                <div className="space-y-1">
                                    {studentHistory.map((rec, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs p-2 rounded hover:bg-slate-50 border-b border-slate-50 last:border-0">
                                            <span className="text-slate-600 font-mono">{rec.date}</span>
                                            <span className={`px-2 py-0.5 rounded font-bold ${
                                                rec.status === AttendanceStatus.ABSENT ? 'bg-red-50 text-red-600' :
                                                rec.status === AttendanceStatus.LATE ? 'bg-amber-50 text-amber-600' :
                                                'bg-emerald-50 text-emerald-600'
                                            }`}>
                                                {rec.status === AttendanceStatus.ABSENT ? 'غائب' : rec.status === AttendanceStatus.LATE ? 'متأخر' : 'حاضر'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-xs text-slate-400 py-4">لا يوجد سجلات سابقة مسجلة لهذا الطالب</p>
                            )}
                        </div>
                    )}
                 </div>

                 {/* Reason */}
                 <div>
                    <h4 className="font-bold text-slate-800 mb-2 text-sm flex items-center gap-2">
                        <FileText size={16} className="text-blue-500"/> سبب الغياب
                    </h4>
                    <div className="bg-white border border-slate-200 p-4 rounded-xl">
                        <p className="font-bold text-slate-900 mb-2 text-sm">{selectedReq.reason}</p>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            {selectedReq.details || 'لا توجد تفاصيل إضافية مكتوبة.'}
                        </p>
                    </div>
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
              </div>

              {/* Footer Actions */}
              <div className="p-4 md:p-5 border-t border-slate-100 bg-white sticky bottom-0 z-10 flex gap-3">
                 <button 
                   onClick={() => handleStatusChange(selectedReq.id, RequestStatus.APPROVED)}
                   className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 active:scale-95"
                 >
                    <Check size={18} /> قبول
                 </button>
                 <button 
                   onClick={() => handleStatusChange(selectedReq.id, RequestStatus.REJECTED)}
                   className="flex-1 bg-white border-2 border-red-100 text-red-600 py-3 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 active:scale-95"
                 >
                    <X size={18} /> رفض
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default StaffRequests;
