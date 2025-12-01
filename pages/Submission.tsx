
import React, { useState, useMemo, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Upload, CheckCircle, Calendar, User, FileText, Sparkles, AlertCircle, ChevronRight, Home, Paperclip, CalendarDays, Clock, ArrowRight } from 'lucide-react';
import { getStudents, addRequest, uploadFile } from '../services/storage';
import { Student, ExcuseRequest, RequestStatus } from '../types';
import { GRADES } from '../constants';

const { useNavigate, useSearchParams } = ReactRouterDOM as any;

const Submission: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1); // 1: Form, 2: Success
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  
  // Lock states
  const [isStudentLocked, setIsStudentLocked] = useState(false);
  const [isDateLocked, setIsDateLocked] = useState(false);

  // Form State
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  
  // Date Logic
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [date, setDate] = useState(''); // Start Date
  const [endDate, setEndDate] = useState(''); // End Date

  const [file, setFile] = useState<File | null>(null);

  // Data
  const [students, setStudents] = useState<Student[]>([]);

  const SCHOOL_NAME = localStorage.getItem('school_name') || "مدرسة عماد الدين زنكي المتوسطة";

  useEffect(() => {
    const fetchData = async () => {
      const data = await getStudents();
      setStudents(data);
      setDataLoading(false);
    };
    fetchData();
  }, []);

  const availableClasses = useMemo(() => {
    if (!selectedGrade) return [];
    const classes = new Set(
        students
        .filter(s => s.grade === selectedGrade && s.className)
        .map(s => s.className)
    );
    return Array.from(classes).sort();
  }, [students, selectedGrade]);

  const availableStudents = useMemo(() => {
    return students.filter(
      (s) => s.grade === selectedGrade && s.className === selectedClass
    );
  }, [students, selectedGrade, selectedClass]);

  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  // Auto-fill from URL
  useEffect(() => {
    if (dataLoading) return;

    const urlStudentId = searchParams.get('studentId'); 
    const urlDate = searchParams.get('date');

    if (urlStudentId) {
      const targetStudent = students.find(s => s.studentId === urlStudentId);
      if (targetStudent) {
        setSelectedGrade(targetStudent.grade);
        setSelectedClass(targetStudent.className);
        setSelectedStudentId(targetStudent.id);
        setIsStudentLocked(true);
      }
    }
    if (urlDate) {
      setDate(urlDate);
      setIsDateLocked(true);
      setIsMultiDay(false);
    }
  }, [searchParams, students, dataLoading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 5 * 1024 * 1024) {
        alert("حجم الملف كبير جداً. الحد الأقصى هو 5 ميجابايت.");
        e.target.value = '';
        return;
      }
      setFile(selectedFile);
    }
  };

  const getDatesInRange = (startDateStr: string, endDateStr: string) => {
      const dates = [];
      const current = new Date(startDateStr);
      const end = new Date(endDateStr);
      let count = 0;
      while (current <= end && count < 30) {
          const day = current.getDay();
          if (day !== 5 && day !== 6) { // Skip Fri/Sat
              dates.push(new Date(current).toISOString().split('T')[0]);
          }
          current.setDate(current.getDate() + 1);
          count++;
      }
      return dates;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStudentId || !reason || !date || !file) return;
    if (isMultiDay && !endDate) { alert("يرجى تحديد تاريخ نهاية الغياب."); return; }
    if (isMultiDay && new Date(endDate) < new Date(date)) { alert("تاريخ النهاية يجب أن يكون بعد تاريخ البداية."); return; }

    // Logic similar to previous implementation
    let datesToSubmit: string[] = [];
    if (isMultiDay) {
        datesToSubmit = getDatesInRange(date, endDate);
        if (datesToSubmit.length === 0) { alert("الفترة المحددة لا تحتوي على أيام دراسية."); return; }
    } else {
        const selectedDateObj = new Date(date);
        const day = selectedDateObj.getDay(); 
        if (day === 5 || day === 6) { alert("لا يمكن تقديم عذر في أيام العطلة."); return; }
        datesToSubmit = [date];
    }

    setLoading(true);

    try {
      const student = students.find(s => s.id === selectedStudentId);
      if (student) {
        const attachmentUrl = await uploadFile(file);
        if (!attachmentUrl) throw new Error("Upload failed");

        for (const d of datesToSubmit) {
            const newRequest: ExcuseRequest = {
              id: '', 
              studentId: student.studentId,
              studentName: student.name,
              grade: student.grade,
              className: student.className,
              date: d,
              reason,
              details: isMultiDay ? `${details} (عذر متصل من ${date} إلى ${endDate})` : details,
              attachmentName: file.name,
              attachmentUrl: attachmentUrl, 
              status: RequestStatus.PENDING,
              submissionDate: new Date().toISOString(),
            };
            await addRequest(newRequest);
        }
        setStep(2); 
      }
    } catch (e) {
      alert("حدث خطأ أثناء الإرسال. تأكد من الاتصال.");
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  const maxDate = today.toISOString().split('T')[0];
  const minDateObj = new Date();
  minDateObj.setDate(today.getDate() - 30); 
  const minDate = minDateObj.toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      
      {/* Header Image / Branding */}
      <div className="bg-blue-900 h-48 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-30"></div>
          <div className="absolute top-10 -left-10 w-48 h-48 bg-purple-500 rounded-full blur-3xl opacity-30"></div>
          
          <div className="max-w-2xl mx-auto px-6 h-full flex flex-col justify-center relative z-10 text-white">
              <div className="flex items-center gap-2 mb-2 opacity-80">
                  <Sparkles size={16} className="text-amber-300"/>
                  <span className="text-xs font-bold uppercase tracking-wider">نظام الإدارة الذكية</span>
              </div>
              <h1 className="text-3xl font-extrabold mb-1">{SCHOOL_NAME}</h1>
              <p className="text-blue-200 text-sm">بوابة تقديم الأعذار الطبية والطارئة</p>
          </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-10 relative z-20">
        
        {step === 1 && (
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                
                {/* 1. Student Selection */}
                <div className="p-6 md:p-8 border-b border-slate-50">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">1</div>
                        <h2 className="text-lg font-bold text-slate-800">بيانات الطالب</h2>
                    </div>

                    <div className="space-y-4">
                        {!isStudentLocked ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">الصف الدراسي</label>
                                    <select required value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); setSelectedClass(''); setSelectedStudentId(''); }} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                        <option value="">اختر الصف</option>
                                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">الفصل</label>
                                    <select required disabled={!selectedGrade} value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudentId(''); }} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50">
                                        <option value="">اختر الفصل</option>
                                        {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
                                <User className="text-blue-600" size={24}/>
                                <div>
                                    <p className="text-xs text-blue-500 font-bold uppercase">تقديم عذر للطالب</p>
                                    <p className="font-bold text-blue-900">{selectedStudent?.name}</p>
                                    <p className="text-xs text-blue-700">{selectedStudent?.grade} - {selectedStudent?.className}</p>
                                </div>
                            </div>
                        )}

                        {!isStudentLocked && (
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1.5 block">اسم الطالب</label>
                                <select required disabled={!selectedClass} value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50">
                                    <option value="">اختر الطالب من القائمة</option>
                                    {availableStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Absence Details */}
                <div className="p-6 md:p-8 border-b border-slate-50">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center font-bold">2</div>
                        <h2 className="text-lg font-bold text-slate-800">تفاصيل الغياب</h2>
                    </div>

                    <div className="space-y-5">
                        {/* Toggle Multi-day */}
                        {!isDateLocked && (
                            <div className="bg-slate-50 p-1.5 rounded-xl flex items-center relative">
                                <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-lg shadow-sm transition-all duration-300 ${isMultiDay ? 'left-1.5' : 'left-[calc(50%+3px)]'}`}></div>
                                <button type="button" onClick={() => setIsMultiDay(true)} className={`flex-1 relative z-10 text-sm font-bold py-2 text-center transition-colors ${isMultiDay ? 'text-purple-700' : 'text-slate-500'}`}>
                                    عدة أيام متصلة
                                </button>
                                <button type="button" onClick={() => setIsMultiDay(false)} className={`flex-1 relative z-10 text-sm font-bold py-2 text-center transition-colors ${!isMultiDay ? 'text-purple-700' : 'text-slate-500'}`}>
                                    يوم واحد
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1.5 block">تاريخ الغياب (البداية)</label>
                                <div className="relative">
                                    <input type="date" required min={minDate} max={maxDate} value={date} disabled={isDateLocked} onChange={(e) => setDate(e.target.value)} className="w-full p-3 pl-10 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-100 disabled:bg-slate-100 disabled:text-slate-400" />
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                </div>
                            </div>
                            {isMultiDay && (
                                <div className="animate-fade-in">
                                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">تاريخ النهاية (إلى)</label>
                                    <div className="relative">
                                        <input type="date" required min={date} max={maxDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 pl-10 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-100" />
                                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1.5 block">سبب الغياب</label>
                            <select required value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-100">
                                <option value="">اختر السبب...</option>
                                <option value="عذر مرضي">عذر مرضي (تقرير طبي)</option>
                                <option value="ظروف عائلية">ظروف عائلية</option>
                                <option value="موعد مستشفى">موعد مستشفى</option>
                                <option value="حالة طارئة">حالة طارئة</option>
                                <option value="أخرى">أخرى</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1.5 block">تفاصيل إضافية (اختياري)</label>
                            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-100 resize-none" placeholder="أي ملاحظات إضافية..."></textarea>
                        </div>
                    </div>
                </div>

                {/* 3. Attachments */}
                <div className="p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">3</div>
                        <h2 className="text-lg font-bold text-slate-800">المرفقات</h2>
                    </div>

                    <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative group ${file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
                        <input type="file" id="file-upload" required accept=".jpg,.jpeg,.png,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} />
                        {file ? (
                            <div className="flex flex-col items-center animate-fade-in">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-emerald-500"><CheckCircle size={32}/></div>
                                <p className="font-bold text-emerald-800 mb-1 truncate max-w-full px-4">{file.name}</p>
                                <p className="text-xs text-emerald-600">اضغط للتغيير</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-500 transition-colors">
                                <Upload size={40} className="mb-3"/>
                                <p className="font-bold text-sm">اضغط لرفع التقرير الطبي أو الإثبات</p>
                                <p className="text-xs mt-1 opacity-70">JPG, PNG, PDF (Max 5MB)</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 bg-slate-50 border-t border-slate-100">
                    <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3">
                        {loading ? <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> جاري الإرسال...</span> : <>إرسال الطلب <ArrowRight size={20}/></>}
                    </button>
                </div>
            </form>
        )}

        {/* Success View */}
        {step === 2 && (
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center animate-fade-in-up">
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <CheckCircle size={48} />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800 mb-2">تم استلام طلبك بنجاح</h2>
                <p className="text-slate-500 mb-8 max-w-xs mx-auto">سيتم مراجعة العذر من قبل إدارة المدرسة والرد عليكم قريباً.</p>
                
                <div className="space-y-3">
                    <button onClick={() => navigate('/')} className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                        <Home size={18}/> العودة للرئيسية
                    </button>
                    <button onClick={() => window.location.reload()} className="w-full py-4 bg-white border-2 border-slate-100 text-blue-600 font-bold rounded-2xl hover:border-blue-100 hover:bg-blue-50 transition-colors">
                        تقديم طلب آخر
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default Submission;