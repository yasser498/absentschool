import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Edit, Trash2, Printer, Loader2, FileText, School, User, Calendar, Sparkles, Trophy } from 'lucide-react';
import { getStudents, addStudentObservation, getStudentObservations, updateStudentObservation, deleteStudentObservation, analyzeSentiment, addStudentPoints } from '../../services/storage';
import { Student, StaffUser, StudentObservation } from '../../types';
import { GRADES } from '../../constants';

const StaffObservations: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [observations, setObservations] = useState<StudentObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formGrade, setFormGrade] = useState('');
  const [formClass, setFormClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [obsType, setObsType] = useState<'academic' | 'behavioral' | 'positive' | 'general'>('general');
  const [obsContent, setObsContent] = useState('');
  
  // AI & Points State
  const [sentiment, setSentiment] = useState<'positive'|'negative'|'neutral'|null>(null);
  const [points, setPoints] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);

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

  const checkSentiment = async () => {
      if(!obsContent) return;
      setAnalyzing(true);
      const res = await analyzeSentiment(obsContent);
      setSentiment(res);
      setAnalyzing(false);
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

  const handlePrint = () => { window.print(); };

  const getTypeLabel = (type: string) => {
    switch (type) { case 'academic': return 'أكاديمية'; case 'behavioral': return 'سلوكية'; case 'positive': return 'تعزيز إيجابي'; default: return 'عامة'; }
  };

  const getTypeColor = (type: string) => {
    switch (type) { case 'academic': return 'bg-blue-100 text-blue-700'; case 'behavioral': return 'bg-amber-100 text-amber-700'; case 'positive': return 'bg-emerald-100 text-emerald-700'; default: return 'bg-slate-100 text-slate-700'; }
  };

  return (
    <>
      {/* ... (Print styles same as before) ... */}
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #print-area, #print-area * { visibility: visible; }
            #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
            .no-print { display: none !important; }
          }
        `}
      </style>

      {/* Main UI */}
      <div className="space-y-6 animate-fade-in no-print">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-pink-50 p-2 rounded-xl text-pink-600"><FileText size={24} /></div>
            <div><h1 className="text-xl font-bold text-slate-900">ملاحظات الطلاب</h1><p className="text-xs text-slate-500">تسجيل ومتابعة الملاحظات الصفية</p></div>
          </div>
          <button onClick={() => setShowModal(true)} className="bg-pink-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-700 shadow-sm"><Plus size={18} /> إضافة ملاحظة</button>
        </div>

        {/* ... (Controls and List same as before) ... */}
        {/* For brevity, I'm focusing on the updated Modal */}
        
        <div className="grid grid-cols-1 gap-4">
          {loading ? <div className="py-20 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2"/>جاري التحميل...</div> 
          : filteredObservations.length === 0 ? <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200"><FileText className="mx-auto mb-4 opacity-50" size={48} /><p>لا توجد ملاحظات مسجلة</p></div> 
          : filteredObservations.map(obs => (
              <div key={obs.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-1.5 h-full ${obs.sentiment === 'positive' ? 'bg-emerald-500' : obs.sentiment === 'negative' ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                <div className="flex justify-between items-start mb-3 pl-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">{obs.studentName.charAt(0)}</div>
                    <div><h3 className="font-bold text-slate-800">{obs.studentName}</h3><p className="text-xs text-slate-500">{obs.grade} - {obs.className}</p></div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTypeColor(obs.type)}`}>{getTypeLabel(obs.type)}</span>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">{obs.content}</p>
                <div className="flex justify-between items-center mt-4 text-xs text-slate-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><Calendar size={12}/> {obs.date}</span>
                    <span className="flex items-center gap-1"><User size={12}/> {obs.staffName}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(obs)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Edit size={16}/></button>
                    <button onClick={() => handleDelete(obs.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={16}/></button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold mb-6 text-slate-800">{isEditing ? 'تعديل ملاحظة' : 'إضافة ملاحظة جديدة'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isEditing && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">الصف</label>
                        <select value={formGrade} onChange={e => { setFormGrade(e.target.value); setFormClass(''); }} className="w-full p-2 border rounded-lg bg-white"><option value="">اختر...</option>{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">الفصل</label>
                        <select value={formClass} disabled={!formGrade} onChange={e => setFormClass(e.target.value)} className="w-full p-2 border rounded-lg bg-white"><option value="">اختر...</option>{availableClasses.map(c => <option key={c} value={c}>{c}</option>)}</select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">الطالب</label>
                      <select required value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="w-full p-2 border rounded-lg bg-white"><option value="">اختر الطالب...</option>{availableStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    </div>
                  </>
                )}
                
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">نوع الملاحظة</label>
                  <select value={obsType} onChange={e => setObsType(e.target.value as any)} className="w-full p-2 border rounded-lg bg-white">
                    <option value="general">عامة</option>
                    <option value="academic">أكاديمية (مستوى دراسي)</option>
                    <option value="behavioral">سلوكية (تنبيه)</option>
                    <option value="positive">تعزيز إيجابي</option>
                  </select>
                </div>

                {/* Points & AI Section */}
                {obsType === 'positive' && (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-center gap-3">
                        <Trophy className="text-amber-500" size={20}/>
                        <label className="text-xs font-bold text-amber-700">منح نقاط تميز:</label>
                        <input type="number" value={points} onChange={e=>setPoints(Number(e.target.value))} className="w-20 p-1 rounded border border-amber-200 text-center font-bold"/>
                    </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">نص الملاحظة</label>
                  <textarea required value={obsContent} onChange={e => setObsContent(e.target.value)} className="w-full p-3 border rounded-lg min-h-[100px]" placeholder="اكتب الملاحظة هنا..."></textarea>
                  <div className="flex justify-end mt-2 items-center gap-2">
                      {sentiment && <span className={`text-xs px-2 py-1 rounded font-bold ${sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' : sentiment === 'negative' ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>{sentiment === 'positive' ? 'إيجابي' : sentiment === 'negative' ? 'سلبي' : 'محايد'}</span>}
                      <button type="button" onClick={checkSentiment} disabled={analyzing} className="text-xs flex items-center gap-1 text-purple-600 font-bold hover:bg-purple-50 px-2 py-1 rounded">{analyzing ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>} تحليل نبرة الملاحظة (AI)</button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-pink-600 text-white py-2.5 rounded-lg font-bold hover:bg-pink-700">حفظ</button>
                  <button type="button" onClick={resetForm} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-lg font-bold hover:bg-slate-200">إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default StaffObservations;