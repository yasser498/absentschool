import React, { useState, useMemo, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Upload, CheckCircle, AlertCircle, Copy, Check, Info, Sparkles, AlertTriangle, Loader2, Lock, X } from 'lucide-react';
import { getStudents, addRequest, uploadFile } from '../services/storage';
import { Student, ExcuseRequest, RequestStatus } from '../types';
import { GRADES } from '../constants';

const { useNavigate, useSearchParams } = ReactRouterDOM as any;

const Submission: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Lock states to prevent changing details when redirected from profile/alerts
  const [isStudentLocked, setIsStudentLocked] = useState(false);
  const [isDateLocked, setIsDateLocked] = useState(false);

  // Form State
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [date, setDate] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Data
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getStudents();
      setStudents(data);
      setDataLoading(false);
    };
    fetchData();
  }, []);

  // Instant Class Loading using Memoization
  const availableClasses = useMemo(() => {
    if (!selectedGrade) return [];
    const classes = new Set(
        students
        .filter(s => s.grade === selectedGrade && s.className)
        .map(s => s.className)
    );
    return Array.from(classes).sort();
  }, [students, selectedGrade]);

  // Filtered Students based on selection
  const availableStudents = useMemo(() => {
    return students.filter(
      (s) => s.grade === selectedGrade && s.className === selectedClass
    );
  }, [students, selectedGrade, selectedClass]);

  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  // Auto-fill from URL parameters
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
        setIsStudentLocked(true); // Lock the student fields
      }
    }
    if (urlDate) {
      setDate(urlDate);
      setIsDateLocked(true); // Lock the date field
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !reason || !date || !file) return;

    // Strict Validation
    const selectedDateObj = new Date(date);
    const day = selectedDateObj.getDay(); 
    
    // Check if weekend (Friday=5, Saturday=6)
    if (day === 5 || day === 6) {
        alert("لا يمكن تقديم عذر في أيام الجمعة أو السبت (عطلة رسمية).");
        return;
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    selectedDateObj.setHours(0,0,0,0);

    const diffTime = today.getTime() - selectedDateObj.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);

    if (selectedDateObj > today) {
        alert("لا يمكن اختيار تاريخ مستقبلي.");
        return;
    }

    // Allow older dates IF it was pre-filled (locked) via the system alert
    // Otherwise, enforce the 7-day rule
    if (!isDateLocked && diffDays > 7) {
        alert("عفواً، لا يمكن تقديم عذر لغياب مضى عليه أكثر من 7 أيام.");
        return;
    }

    setLoading(true);

    try {
      const student = students.find(s => s.id === selectedStudentId);
      if (student) {
        const attachmentUrl = await uploadFile(file);

        if (!attachmentUrl) {
            alert("فشل رفع المرفق. يرجى التأكد من الاتصال بالإنترنت والمحاولة مرة أخرى.");
            setLoading(false);
            return;
        }

        const newRequest: ExcuseRequest = {
          id: '', 
          studentId: student.studentId,
          studentName: student.name,
          grade: student.grade,
          className: student.className,
          date,
          reason,
          details,
          attachmentName: file.name,
          attachmentUrl: attachmentUrl, 
          status: RequestStatus.PENDING,
          submissionDate: new Date().toISOString(),
        };
        await addRequest(newRequest);
        setStep(2); 
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Reset Locks to allow new submission
  const unlockForm = () => {
    setIsStudentLocked(false);
    setIsDateLocked(false);
    navigate('/submit'); // Clear params
    setSelectedGrade('');
    setSelectedClass('');
    setSelectedStudentId('');
    setDate('');
  };

  const today = new Date();
  const maxDate = today.toISOString().split('T')[0];
  // Calculate min date only if not locked (if locked, we accept whatever the system passed)
  const minDateObj = new Date();
  minDateObj.setDate(today.getDate() - 30); // Allow system to pass older dates, UI restricts picker
  const minDate = minDateObj.toISOString().split('T')[0];

  const inputClasses = "w-full p-3.5 md:p-3 bg-white border border-slate-300 text-slate-900 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none transition-all shadow-sm placeholder:text-slate-400 text-base disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";
  const labelClasses = "block text-sm font-bold text-slate-700 mb-2";

  if (dataLoading) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-blue-900 mb-4" size={48} />
          <p className="text-slate-500 font-bold">جاري الاتصال بالنظام...</p>
       </div>
    );
  }

  if (step === 2) {
    return (
      <div className="max-w-lg mx-auto bg-white p-8 rounded-2xl shadow-xl border border-slate-100 text-center space-y-6 animate-fade-in-up mt-12">
        <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-100">
          <CheckCircle size={48} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">تم إرسال الطلب بنجاح</h2>
          <p className="text-slate-500">سيتم مراجعة العذر من قبل إدارة متوسطة عماد الدين زنكي وإشعاركم بالحالة.</p>
        </div>
        <div className="pt-6 space-y-3">
          <button 
            onClick={() => navigate('/')}
            className="w-full py-4 md:py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-lg md:text-base"
          >
            عودة للرئيسية
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 md:py-3 bg-blue-900 text-white font-bold rounded-xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/20 text-lg md:text-base"
          >
            تقديم طلب آخر
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-2 md:px-0">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-blue-900 p-6 md:p-8 text-white relative overflow-hidden">
          <div className="relative z-10 flex justify-between items-start">
            <div>
               <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">تقديم عذر غياب</h2>
               <p className="text-blue-200 text-xs md:text-sm font-medium opacity-90">نموذج رسمي - متوسطة عماد الدين زنكي</p>
            </div>
            <div className="bg-white/10 p-2 rounded-lg backdrop-blur-md border border-white/20">
               <Sparkles className="text-amber-400" size={24} />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500 opacity-10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl pointer-events-none"></div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 md:p-10 space-y-6 md:space-y-8">
          
          {/* Locked State Banner */}
          {(isStudentLocked || isDateLocked) && selectedStudent && (
             <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-3">
                   <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                      <Lock size={20} />
                   </div>
                   <div>
                      <p className="text-xs font-bold text-amber-800 uppercase mb-0.5">تقديم عذر محدد:</p>
                      <p className="text-sm font-bold text-slate-800">{selectedStudent.name} {isDateLocked && ` - ليوم ${date}`}</p>
                   </div>
                </div>
                <button 
                  type="button" 
                  onClick={unlockForm}
                  className="text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 font-bold transition-colors"
                >
                   إلغاء وطلب جديد
                </button>
             </div>
          )}

          {/* Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div>
              <label className={labelClasses}>الصف الدراسي {isStudentLocked && <Lock size={12} className="inline ml-1 text-slate-400"/>}</label>
              <select 
                required
                value={selectedGrade}
                onChange={(e) => { setSelectedGrade(e.target.value); setSelectedClass(''); setSelectedStudentId(''); }}
                className={inputClasses}
                disabled={isStudentLocked}
              >
                <option value="">اختر الصف...</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClasses}>الفصل {isStudentLocked && <Lock size={12} className="inline ml-1 text-slate-400"/>}</label>
              <select 
                  required
                  disabled={!selectedGrade || isStudentLocked}
                  value={selectedClass}
                  onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudentId(''); }}
                  className={inputClasses}
              >
                  <option value="">{selectedGrade ? 'اختر الفصل...' : 'اختر الصف أولاً'}</option>
                  {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Student Selection */}
          <div>
            <label className={labelClasses}>اسم الطالب {isStudentLocked && <Lock size={12} className="inline ml-1 text-slate-400"/>}</label>
            <select 
              required
              disabled={!selectedClass || isStudentLocked}
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className={inputClasses}
            >
              <option value="">اختر الطالب من القائمة...</option>
              {availableStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {selectedGrade && selectedClass && availableStudents.length === 0 && (
              <p className="text-sm text-red-500 flex items-center gap-1 mt-2 font-medium">
                <AlertCircle size={14} /> لا يوجد طلاب مسجلين في هذا الفصل
              </p>
            )}
          </div>

          {/* Student ID Info Alert */}
          {selectedStudent && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm relative overflow-hidden gap-4">
                <div className="absolute right-0 top-0 w-1 h-full bg-blue-900"></div>
                <div className="flex items-center gap-4 md:gap-5">
                  <div className="bg-white p-3 rounded-full text-blue-900 shadow-sm border border-blue-100 shrink-0">
                    <Info size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-blue-800 font-bold mb-1 opacity-80">رقم الطالب (السجل المدني)</p>
                    <p className="text-xl md:text-2xl font-bold text-slate-900 font-mono tracking-wider">{selectedStudent.studentId}</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => copyToClipboard(selectedStudent.studentId)}
                  className={`w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 md:py-2.5 rounded-lg transition-all font-bold text-sm shadow-sm
                    ${copied 
                      ? 'bg-emerald-600 text-white border border-emerald-600' 
                      : 'bg-white text-blue-900 border border-blue-200 hover:bg-blue-50'
                    }`}
                  title="نسخ الرقم"
                >
                  {copied ? (
                    <>
                      <Check size={18} />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      <span>نسخ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-2"></div>

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
             <div>
              <label className={labelClasses}>تاريخ الغياب {isDateLocked && <Lock size={12} className="inline ml-1 text-slate-400"/>}</label>
              <input 
                type="date" 
                required
                min={minDate}
                max={maxDate}
                value={date}
                disabled={isDateLocked}
                onChange={(e) => setDate(e.target.value)}
                className={inputClasses}
              />
              {!isDateLocked && (
                <p className="text-xs text-amber-600 mt-2 font-medium flex items-center gap-1">
                    <AlertCircle size={12}/> مسموح آخر 7 أيام فقط (الجمعة/السبت غير مسموح)
                </p>
              )}
            </div>
             <div>
              <label className={labelClasses}>سبب الغياب</label>
              <select 
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputClasses}
              >
                <option value="">اختر السبب...</option>
                <option value="عذر مرضي">عذر مرضي</option>
                <option value="ظروف عائلية">ظروف عائلية</option>
                <option value="موعد مستشفى">موعد مستشفى</option>
                <option value="حالة طارئة">حالة طارئة</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClasses}>تفاصيل إضافية (اختياري)</label>
            <textarea 
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className={inputClasses}
              placeholder="اكتب أي تفاصيل إضافية توضح سبب الغياب..."
            ></textarea>
          </div>

          {/* File Upload */}
          <div>
            <label className={labelClasses}>
              المرفقات (تقرير طبي / إثبات) <span className="text-red-500">*</span>
            </label>
            <div className={`border-2 border-dashed rounded-xl p-6 md:p-8 text-center cursor-pointer transition-colors ${file ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50 bg-slate-50'}`}>
              <input 
                type="file" 
                id="file-upload"
                required
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload" className="cursor-pointer w-full h-full flex flex-col items-center justify-center touch-manipulation">
                {file ? (
                  <>
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                       <CheckCircle size={24} />
                    </div>
                    <span className="text-emerald-800 font-bold text-lg break-all">{file.name}</span>
                    <span className="text-xs text-emerald-600 mt-2 font-medium bg-white px-3 py-1 rounded-full border border-emerald-100">اضغط للتغيير</span>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                       <Upload size={24} />
                    </div>
                    <span className="text-slate-700 font-bold text-lg">اضغط لرفع الملف</span>
                    <span className="text-sm text-slate-400 mt-2">JPG, PNG, PDF (الحد الأقصى 5 ميجابايت)</span>
                  </>
                )}
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg shadow-blue-900/10 transition-all mt-4 active:scale-95
              ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800 hover:shadow-xl hover:-translate-y-1'}
            `}
          >
            {loading ? 'جاري الإرسال...' : 'إرسال الطلب رسمياً'}
          </button>

        </form>
      </div>
    </div>
  );
};

export default Submission;