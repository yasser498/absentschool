import React, { useState, useEffect, useMemo } from 'react';
import { LogOut, Plus, Search, Calendar, User, Phone, CheckCircle, Clock, XCircle, Printer, X } from 'lucide-react';
import { getStudents, addExitPermission, getExitPermissions } from '../../services/storage';
import { Student, StaffUser, ExitPermission } from '../../types';
import { GRADES } from '../../constants';

const ExitPermissions: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [permissions, setPermissions] = useState<ExitPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  // School Name for Print
  const SCHOOL_NAME = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [formGrade, setFormGrade] = useState('');
  const [formClass, setFormClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [reason, setReason] = useState('');

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (session) setCurrentUser(JSON.parse(session));
    
    fetchData();
  }, [reportDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sData, pData] = await Promise.all([
        getStudents(),
        getExitPermissions(reportDate)
      ]);
      setStudents(sData);
      setPermissions(pData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const availableClasses = useMemo(() => {
    if (!formGrade) return [];
    const classes = new Set(students.filter(s => s.grade === formGrade).map(s => s.className));
    return Array.from(classes).sort();
  }, [students, formGrade]);

  const availableStudents = useMemo(() => {
    return students.filter(s => s.grade === formGrade && s.className === formClass);
  }, [students, formGrade, formClass]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !currentUser) return;

    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    try {
      await addExitPermission({
        studentId: student.studentId,
        studentName: student.name,
        grade: student.grade,
        className: student.className,
        parentName,
        parentPhone,
        reason,
        createdBy: currentUser.id,
        createdByName: currentUser.name // Ensure name is passed
      });
      alert('تم تسجيل إذن الاستئذان بنجاح. سيظهر الآن في بوابة الأمن.');
      setShowModal(false);
      // Reset form
      setParentName(''); setParentPhone(''); setReason(''); setSelectedStudentId('');
      fetchData();
    } catch (e) {
      alert('حدث خطأ أثناء الإضافة');
    }
  };

  const filteredPermissions = permissions.filter(p => p.studentName.includes(searchTerm));

  const handlePrint = () => window.print();

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #exit-report-print, #exit-report-print * { visibility: visible; }
          #exit-report-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: white; z-index: 9999; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* OFFICIAL PRINT VIEW */}
      <div id="exit-report-print" className="hidden" dir="rtl">
          <div className="print-page-a4">
            <img src="https://www.raed.net/img?id=1474173" className="print-watermark" alt="Watermark" />
            <div className="print-header">
                <div className="print-header-right">
                    <p>المملكة العربية السعودية</p>
                    <p>وزارة التعليم</p>
                    <p>إدارة التعليم ....................</p>
                    <p>{SCHOOL_NAME}</p>
                </div>
                <div className="print-header-center">
                    <img src="https://www.raed.net/img?id=1474173" className="print-logo" alt="Logo" />
                </div>
                <div className="print-header-left">
                    <p>Ministry of Education</p>
                    <p>Student Exit Log</p>
                    <p>{reportDate}</p>
                </div>
            </div>

            <div className="print-content">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-extrabold underline underline-offset-8 mt-4">بيان استئذان الطلاب اليومي</h1>
                </div>

                <table className="w-full text-right border-collapse border border-black text-sm mt-4">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-2 w-10">م</th>
                            <th className="border border-black p-2">اسم الطالب</th>
                            <th className="border border-black p-2">الصف / الفصل</th>
                            <th className="border border-black p-2">ولي الأمر (المستلم)</th>
                            <th className="border border-black p-2">سبب الاستئذان</th>
                            <th className="border border-black p-2">المصرح (الموظف)</th>
                            <th className="border border-black p-2">وقت الخروج</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPermissions.length > 0 ? (
                            filteredPermissions.map((p, idx) => (
                                <tr key={idx}>
                                    <td className="border border-black p-2 text-center">{idx + 1}</td>
                                    <td className="border border-black p-2 font-bold">{p.studentName}</td>
                                    <td className="border border-black p-2">{p.grade} - {p.className}</td>
                                    <td className="border border-black p-2">{p.parentName}</td>
                                    <td className="border border-black p-2">{p.reason}</td>
                                    <td className="border border-black p-2">{p.createdByName || '-'}</td>
                                    <td className="border border-black p-2 text-center">
                                        {p.status === 'completed' && p.completedAt 
                                            ? new Date(p.completedAt).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'}) 
                                            : 'انتظار'}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={7} className="border border-black p-4 text-center">لا يوجد استئذان اليوم</td></tr>
                        )}
                    </tbody>
                </table>

                <div className="mt-16 flex justify-between px-12 text-lg">
                    <div className="text-center"><p className="font-bold mb-8">وكيل شؤون الطلاب</p><p>.............................</p></div>
                    <div className="text-center"><p className="font-bold mb-8">مدير المدرسة</p><p>.............................</p></div>
                </div>
            </div>
          </div>
      </div>

      {/* APP VIEW */}
      <div className="space-y-6 animate-fade-in no-print">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-50 p-2 rounded-xl text-orange-600"><LogOut size={24} /></div>
            <div><h1 className="text-xl font-bold text-slate-900">إدارة استئذان الطلاب</h1><p className="text-xs text-slate-500">تسجيل ومتابعة خروج الطلاب أثناء الدوام</p></div>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setShowModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-700 shadow-sm"><Plus size={18} /> طلب استئذان جديد</button>
             <button onClick={handlePrint} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-slate-200"><Printer size={18} /></button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:w-auto">
                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-100" />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            </div>
            <div className="relative w-full md:w-80">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="بحث عن طالب..." className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-100" />
            </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
            {permissions.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                    <LogOut size={48} className="mx-auto mb-4 text-slate-300"/>
                    <p className="text-slate-500">لا يوجد طلبات استئذان لهذا اليوم</p>
                </div>
            ) : (
                filteredPermissions.map(perm => (
                    <div key={perm.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${perm.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                {perm.studentName.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">{perm.studentName}</h3>
                                <p className="text-xs text-slate-500">{perm.grade} - {perm.className}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                    <span className="flex items-center gap-1"><User size={12}/> ولي الأمر: {perm.parentName}</span>
                                    {perm.createdByName && <span className="flex items-center gap-1 font-bold text-slate-500 bg-slate-50 px-2 rounded">المصرح: {perm.createdByName}</span>}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1 w-full md:w-auto">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${perm.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                {perm.status === 'completed' ? <CheckCircle size={14}/> : <Clock size={14}/>}
                                {perm.status === 'completed' ? 'تم الخروج' : 'بانتظار ولي الأمر'}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">وقت الطلب: {new Date(perm.createdAt).toLocaleTimeString('ar-SA')}</span>
                            {perm.completedAt && <span className="text-xs text-emerald-600 font-bold font-mono">خرج في: {new Date(perm.completedAt).toLocaleTimeString('ar-SA')}</span>}
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Modal */}
        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800">تسجيل استئذان جديد</h2>
                        <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">الصف</label>
                                <select value={formGrade} onChange={e => { setFormGrade(e.target.value); setFormClass(''); setSelectedStudentId(''); }} className="w-full p-2 border rounded-lg bg-white"><option value="">اختر...</option>{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">الفصل</label>
                                <select value={formClass} disabled={!formGrade} onChange={e => { setFormClass(e.target.value); setSelectedStudentId(''); }} className="w-full p-2 border rounded-lg bg-white"><option value="">اختر...</option>{availableClasses.map(c => <option key={c} value={c}>{c}</option>)}</select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">الطالب</label>
                            <select required value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="w-full p-2 border rounded-lg bg-white"><option value="">اختر الطالب...</option>{availableStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">اسم ولي الأمر (المستلم)</label>
                            <input required value={parentName} onChange={e => setParentName(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="الاسم الثلاثي"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">رقم الجوال</label>
                            <input required value={parentPhone} onChange={e => setParentPhone(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="05xxxxxxxx"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">سبب الاستئذان</label>
                            <input value={reason} onChange={e => setReason(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="موعد، ظرف عائلي..."/>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-lg font-bold hover:bg-slate-200">إلغاء</button>
                            <button type="submit" className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg font-bold hover:bg-orange-700">حفظ وإرسال للبوابة</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    </>
  );
};

export default ExitPermissions;