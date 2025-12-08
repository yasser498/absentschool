import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Search, Plus, Edit, Trash2, Printer, Loader2, FileText, School, User, Calendar, Sparkles, Trophy, Wand2, MessageCircle, X, Check, Filter } from 'lucide-react';
import { getStudents, addStudentObservation, getStudentObservations, updateStudentObservation, deleteStudentObservation, analyzeSentiment, addStudentPoints, generateSmartContent, acknowledgeObservation } from '../../services/storage';
import { Student, StaffUser, StudentObservation } from '../../types';
import { GRADES } from '../../constants';

// Official Print Header Component
const OfficialHeader = ({ schoolName, subTitle }: { schoolName: string, subTitle: string }) => (
  <div className="print-header">
    <div className="print-header-right">
        <p>المملكة العربية السعودية</p>
        <p>وزارة التعليم</p>
        <p>{schoolName}</p>
        <p>{subTitle}</p>
    </div>
    <div className="print-header-center">
        <img src="https://www.raed.net/img?id=1474173" alt="شعار وزارة التعليم" className="print-logo" />
    </div>
    <div className="print-header-left">
         <p>Kingdom of Saudi Arabia</p>
         <p>Ministry of Education</p>
         <p>Date: {new Date().toLocaleDateString('en-GB')}</p>
    </div>
  </div>
);

const { useNavigate } = ReactRouterDOM as any;

const StaffObservations: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [observations, setObservations] = useState<StudentObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const SCHOOL_NAME = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formGrade, setFormGrade] = useState('');
  const [formClass, setFormClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [obsType, setObsType] = useState<'academic' | 'behavioral' | 'positive' | 'general'>('general');
  const [obsContent, setObsContent] = useState('');
  
  // Reply Modal State
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [selectedObsForReply, setSelectedObsForReply] = useState<StudentObservation | null>(null);
  
  // AI & Points State
  const [sentiment, setSentiment] = useState<'positive'|'negative'|'neutral'|null>(null);
  const [points, setPoints] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (!session) {
      navigate('/staff/login');
      return;
    }
    setCurrentUser(JSON.parse(session));
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sData, oData] = await Promise.all([
        getStudents(),
        getStudentObservations()
      ]);
      setStudents(sData);
      setObservations(oData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const myObservations = useMemo(() => {
    if (!currentUser) return [];
    return observations.filter(o => o.staffId === currentUser.id);
  }, [observations, currentUser]);

  const filteredObservations = useMemo(() => {
    return myObservations.filter(o => 
      o.studentName.includes(searchTerm) || o.content.includes(searchTerm)
    );
  }, [myObservations, searchTerm]);

  // For Printing: Filter by date
  const dailyObservations = useMemo(() => {
      return observations.filter(o => o.date === reportDate);
  }, [observations, reportDate]);

  const availableClasses = useMemo(() => {
    if (!formGrade) return [];
    const classes = new Set(students.filter(s => s.grade === formGrade).map(s => s.className));
    return Array.from(classes).sort();
  }, [students, formGrade]);

  const availableStudents = useMemo(() => {
    return students.filter(s => s.grade === formGrade && s.className === formClass);
  }, [students, formGrade, formClass]);

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormGrade('');
    setFormClass('');
    setSelectedStudentId('');
    setObsType('general');
    setObsContent('');
    setShowModal(false);
    setSentiment(null);
    setPoints(0);
  };

  const handleEdit = (obs: StudentObservation) => {
    setIsEditing(true);
    setEditingId(obs.id);
    setFormGrade(obs.grade);
    setFormClass(obs.className);
    const studentObj = students.find(s => s.studentId === obs.studentId);
    setSelectedStudentId(studentObj ? studentObj.id : ''); 
    setObsType(obs.type);
    setObsContent(obs.content);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("هل أنت متأكد من حذف هذه الملاحظة؟")) {
      await deleteStudentObservation(id);
      fetchData();
    }
  };

  const handleOpenReply = (obs: StudentObservation) => {
      setSelectedObsForReply(obs);
      setReplyContent(obs.parentFeedback || '');
      setShowReplyModal(true);
  };

  const handleSaveReply = async () => {
      if (!selectedObsForReply) return;
      try {
          await acknowledgeObservation(selectedObsForReply.id, replyContent);
          alert("تم حفظ رد ولي الأمر.");
          setShowReplyModal(false);
          setReplyContent('');
          fetchData();
      } catch (e) {
          alert("حدث خطأ");
      }
  };

  const checkSentiment = async () => {
      if(!obsContent) return;
      setAnalyzing(true);
      const res = await analyzeSentiment(obsContent);
      setSentiment(res);
      setAnalyzing(false);
  };

  const handleImprovePhrasing = async () => {
    if (!obsContent.trim()) {
        alert("يرجى كتابة نص الملاحظة أولاً");
        return;
    }
    setIsRewriting(true);
    try {
        const prompt = `
        بصفتك خبيراً تربوياً ولغوياً، قم بإعادة صياغة الملاحظة المدرسية التالية.
        الهدف: جعل الأسلوب مهنياً، تربوياً، واضحاً، وخالياً من الأخطاء اللغوية، مع الحفاظ على المعنى الأصلي.
        النص الأصلي: "${obsContent}"
        `;
        const result = await generateSmartContent(prompt);
        setObsContent(result.trim());
    } catch (error) {
        alert("تعذر تحسين الصيغة حالياً");
    } finally {
        setIsRewriting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !obsContent || !currentUser) return;

    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    // Grant Points if applicable
    if (obsType === 'positive' && points > 0) {
        await addStudentPoints(student.studentId, points, 'تميّز سلوكي/أكاديمي (ملاحظة معلم)', 'academic');
    }

    if (isEditing && editingId) {
      await updateStudentObservation(editingId, obsContent, obsType);
    } else {
      const newObs: StudentObservation = {
        id: '',
        studentId: student.studentId,
        studentName: student.name,
        grade: student.grade,
        className: student.className,
        date: new Date().toISOString().split('T')[0],
        type: obsType,
        content: obsContent,
        staffId: currentUser.id,
        staffName: currentUser.name,
        sentiment: sentiment || 'neutral'
      };
      await addStudentObservation(newObs);
    }
    resetForm();
    fetchData();
  };

  const getTypeLabel = (type: string) => {
    switch (type) { case 'academic': return 'أكاديمي'; case 'behavioral': return 'سلوكي'; case 'positive': return 'إيجابي'; default: return 'عام'; }
  };

  const getTypeColor = (type: string) => {
    switch (type) { case 'academic': return 'bg-blue-100 text-blue-700'; case 'behavioral': return 'bg-amber-100 text-amber-700'; case 'positive': return 'bg-emerald-100 text-emerald-700'; default: return 'bg-slate-100 text-slate-700'; }
  };

  // Type Option Component
  const TypeOption = ({ id, label, icon: Icon, colorClass, selected }: any) => (
      <button 
        type="button" 
        onClick={() => setObsType(id)} 
        className={`flex-1 p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selected ? `border-${colorClass.split('-')[1]}-500 bg-${colorClass.split('-')[1]}-50` : 'border-slate-100 bg-white hover:border-slate-300'}`}
      >
          <div className={`p-2 rounded-full ${colorClass.replace('bg-', 'text-').replace('100', '600')} bg-white shadow-sm`}>
              <Icon size={20}/>
          </div>
          <span className={`text-xs font-bold ${selected ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
      </button>
  );

  return (
    <>
      <div id="print-area" className="hidden" dir="rtl">
          <div className="print-page-a4">
              <OfficialHeader schoolName={SCHOOL_NAME} subTitle="الملاحظات التربوية والسلوكية اليومية" />
              
              <div className="text-center mb-6">
                  <h1 className="official-title">تقرير الملاحظات اليومي</h1>
                  <p className="font-bold">التاريخ: {reportDate}</p>
              </div>

              <table className="w-full text-right border-collapse border border-black text-sm mt-4">
                  <thead>
                      <tr className="bg-gray-100">
                          <th className="border border-black p-2 w-10">م</th>
                          <th className="border border-black p-2">اسم الطالب</th>
                          <th className="border border-black p-2">الصف</th>
                          <th className="border border-black p-2">نوع الملاحظة</th>
                          <th className="border border-black p-2 w-1/3">نص الملاحظة</th>
                          <th className="border border-black p-2">المعلم</th>
                          <th className="border border-black p-2">رد ولي الأمر</th>
                      </tr>
                  </thead>
                  <tbody>
                      {dailyObservations.length > 0 ? dailyObservations.map((obs, idx) => (
                          <tr key={idx}>
                              <td className="border border-black p-2 text-center">{idx + 1}</td>
                              <td className="border border-black p-2 font-bold">{obs.studentName}</td>
                              <td className="border border-black p-2">{obs.grade} - {obs.className}</td>
                              <td className="border border-black p-2">{getTypeLabel(obs.type)}</td>
                              <td className="border border-black p-2">{obs.content}</td>
                              <td className="border border-black p-2">{obs.staffName}</td>
                              <td className="border border-black p-2">{obs.parentFeedback || '-'}</td>
                          </tr>
                      )) : <tr><td colSpan={7} className="border p-4 text-center">لا توجد ملاحظات مسجلة لهذا اليوم</td></tr>}
                  </tbody>
              </table>

              <div className="footer-signatures mt-12">
                  <div className="signature-box"><p className="signature-title">الموجه الطلابي</p><p>.............................</p></div>
                  <div className="signature-box"><p className="signature-title">وكيل شؤون الطلاب</p><p>.............................</p></div>
                  <div className="signature-box"><p className="signature-title">مدير المدرسة</p><p>.............................</p></div>
              </div>
          </div>
      </div>

      {/* Main UI */}
      <div className="space-y-6 animate-fade-in no-print pb-20">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-pink-50 p-2 rounded-xl text-pink-600"><FileText size={24} /></div>
            <div><h1 className="text-xl font-bold text-slate-900">ملاحظات الطلاب</h1><p className="text-xs text-slate-500">تسجيل ومتابعة الملاحظات الصفية</p></div>
          </div>
          <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-600 outline-none"/>
                  <button onClick={() => window.print()} className="bg-white p-1.5 rounded-lg border hover:bg-slate-50" title="طباعة التقرير"><Printer size={16}/></button>
              </div>
              <button onClick={() => setShowModal(true)} className="bg-pink-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-700 shadow-sm shadow-pink-200"><Plus size={18} /> إضافة ملاحظة</button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="بحث في الملاحظات..." className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-100 transition-all font-bold text-slate-700"/>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loading ? <div className="py-20 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2"/>جاري التحميل...</div> 
          : filteredObservations.length === 0 ? <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><FileText className="mx-auto mb-4 opacity-50" size={48} /><p>لا توجد ملاحظات مسجلة</p></div> 
          : filteredObservations.map(obs => (
              <div key={obs.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                <div className={`absolute top-0 right-0 w-1.5 h-full ${obs.sentiment === 'positive' ? 'bg-emerald-500' : obs.sentiment === 'negative' ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                
                <div className="flex justify-between items-start mb-3 pl-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">{obs.studentName.charAt(0)}</div>
                    <div><h3 className="font-bold text-slate-800">{obs.studentName}</h3><p className="text-xs text-slate-500">{obs.grade} - {obs.className}</p></div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTypeColor(obs.type)}`}>{getTypeLabel(obs.type)}</span>
                </div>
                
                <p className="text-slate-700 text-sm leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 relative">
                    {obs.content}
                    <span className="absolute -top-2 left-2 bg-white text-[10px] text-slate-400 px-2 border rounded-full">المحتوى</span>
                </p>

                {obs.parentFeedback && (
                    <div className="mt-3 bg-purple-50 p-3 rounded-xl border border-purple-100 text-xs flex items-start gap-2">
                        <MessageCircle size={14} className="text-purple-600 mt-0.5 shrink-0"/>
                        <div>
                            <span className="font-bold text-purple-700 block mb-1">رد ولي الأمر:</span>
                            <span className="text-slate-700">{obs.parentFeedback}</span>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Calendar size={12}/> {obs.date}</span>
                    <span className="flex items-center gap-1"><User size={12}/> {obs.staffName}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenReply(obs)} className="text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-100 transition-colors">
                        {obs.parentFeedback ? 'تعديل الرد' : 'تسجيل رد ولي الأمر'}
                    </button>
                    <div className="w-px h-6 bg-slate-100 mx-1"></div>
                    <button onClick={() => handleEdit(obs)} className="text-blue-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"><Edit size={16}/></button>
                    <button onClick={() => handleDelete(obs.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {/* Add/Edit Modal (Improved UI) */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <div className="bg-pink-100 p-2 rounded-lg text-pink-600"><FileText size={20}/></div>
                      {isEditing ? 'تعديل ملاحظة' : 'تسجيل ملاحظة جديدة'}
                  </h2>
                  <button onClick={resetForm} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                {!isEditing && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                    <label className="text-xs font-bold text-slate-400 uppercase">بيانات الطالب</label>
                    <div className="grid grid-cols-2 gap-3">
                        <select value={formGrade} onChange={e => { setFormGrade(e.target.value); setFormClass(''); }} className="w-full p-3 border-none rounded-xl bg-white text-sm font-bold shadow-sm focus:ring-2 focus:ring-pink-100 outline-none"><option value="">الصف</option>{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select>
                        <select value={formClass} disabled={!formGrade} onChange={e => setFormClass(e.target.value)} className="w-full p-3 border-none rounded-xl bg-white text-sm font-bold shadow-sm focus:ring-2 focus:ring-pink-100 outline-none disabled:opacity-50"><option value="">الفصل</option>{availableClasses.map(c => <option key={c} value={c}>{c}</option>)}</select>
                    </div>
                    <select required value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="w-full p-3 border-none rounded-xl bg-white text-sm font-bold shadow-sm focus:ring-2 focus:ring-pink-100 outline-none"><option value="">اختر الطالب...</option>{availableStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  </div>
                )}
                
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase block mb-3">نوع الملاحظة</label>
                  <div className="flex gap-2">
                      <TypeOption id="general" label="عامة" icon={FileText} colorClass="bg-slate-100" selected={obsType==='general'}/>
                      <TypeOption id="academic" label="أكاديمية" icon={School} colorClass="bg-blue-100" selected={obsType==='academic'}/>
                      <TypeOption id="behavioral" label="سلوكية" icon={Filter} colorClass="bg-amber-100" selected={obsType==='behavioral'}/>
                      <TypeOption id="positive" label="إيجابي" icon={Trophy} colorClass="bg-emerald-100" selected={obsType==='positive'}/>
                  </div>
                </div>

                {/* Points & AI Section */}
                {obsType === 'positive' && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-2">
                            <Trophy className="text-emerald-600" size={20}/>
                            <label className="text-sm font-bold text-emerald-800">نقاط تميز إضافية:</label>
                        </div>
                        <input type="number" value={points} onChange={e=>setPoints(Number(e.target.value))} className="w-20 p-2 rounded-lg border border-emerald-200 text-center font-bold outline-none focus:border-emerald-500" min="0"/>
                    </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase block mb-2">نص الملاحظة</label>
                  <textarea required value={obsContent} onChange={e => setObsContent(e.target.value)} className="w-full p-4 border border-slate-200 rounded-xl min-h-[120px] outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-50 transition-all text-sm leading-relaxed" placeholder="اكتب تفاصيل الملاحظة هنا..."></textarea>
                  
                  <div className="flex justify-end gap-2 mt-2">
                        <button type="button" onClick={handleImprovePhrasing} disabled={isRewriting} className="text-xs flex items-center gap-1 text-blue-600 font-bold hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 bg-white transition-colors">
                            {isRewriting ? <Loader2 className="animate-spin" size={14}/> : <Wand2 size={14}/>} تحسين الصياغة
                        </button>
                        <button type="button" onClick={checkSentiment} disabled={analyzing} className="text-xs flex items-center gap-1 text-purple-600 font-bold hover:bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100 bg-white transition-colors">
                            {analyzing ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14}/>} تحليل النبرة
                        </button>
                  </div>
                  {sentiment && <div className={`mt-2 text-xs font-bold px-3 py-2 rounded-lg w-fit ${sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' : sentiment === 'negative' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>التحليل: {sentiment === 'positive' ? 'إيجابي' : sentiment === 'negative' ? 'سلبي' : 'محايد'}</div>}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 flex gap-3">
                  <button type="button" onClick={resetForm} className="flex-1 bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors">إلغاء</button>
                  <button type="button" onClick={handleSubmit} className="flex-1 bg-pink-600 text-white py-3 rounded-xl font-bold hover:bg-pink-700 shadow-lg shadow-pink-600/20 transition-all">حفظ الملاحظة</button>
              </div>
            </div>
          </div>
        )}

        {/* Reply Modal */}
        {showReplyModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><MessageCircle className="text-purple-600"/> تسجيل رد ولي الأمر</h3>
                    <div className="bg-slate-50 p-3 rounded-xl text-sm text-slate-600 mb-4 border border-slate-100 italic">
                        "{selectedObsForReply?.content}"
                    </div>
                    <textarea 
                        autoFocus
                        value={replyContent} 
                        onChange={e => setReplyContent(e.target.value)} 
                        className="w-full p-3 border border-slate-200 rounded-xl min-h-[100px] outline-none focus:ring-2 focus:ring-purple-100 mb-4" 
                        placeholder="ماذا كان رد ولي الأمر؟ (تم الاتصال، حضر للمدرسة، وعد بالتحسن...)"
                    ></textarea>
                    <div className="flex gap-2">
                        <button onClick={() => setShowReplyModal(false)} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-xl font-bold">إلغاء</button>
                        <button onClick={handleSaveReply} className="flex-1 bg-purple-600 text-white py-2 rounded-xl font-bold hover:bg-purple-700">حفظ الرد</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </>
  );
};

export default StaffObservations;
