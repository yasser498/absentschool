
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Search, UserCheck, School, X, CheckSquare, Square, Loader2, RefreshCw, Edit, Save, Smartphone, Hash, GraduationCap } from 'lucide-react';
import { getStudents, syncStudentsBatch, getStudentsSync, addStudent, deleteStudent, updateStudent, getAvailableClassesForGrade } from '../../services/storage';
import { Student } from '../../types';
import { GRADES, CLASSES } from '../../constants';

// Declare XLSX for TypeScript since it's loaded via CDN in index.html
declare var XLSX: any;

const Students: React.FC = () => {
  const [students, setStudents] = useState<Student[]>(() => getStudentsSync() || []);
  const [loading, setLoading] = useState(() => !getStudentsSync());
  const [error, setError] = useState<string | null>(null);
  
  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [processingFile, setProcessingFile] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  // Student Form State
  const [formData, setFormData] = useState({
      name: '',
      studentId: '',
      grade: GRADES[0],
      className: '',
      phone: ''
  });

  // Dynamic class list for suggestions
  const [existingClassesForForm, setExistingClassesForForm] = useState<string[]>([]);

  const fetchStudents = async (force = false) => {
    if (force || students.length === 0) setLoading(true);
    setError(null);
    try {
        const data = await getStudents(force);
        setStudents(data);
    } catch (e: any) {
        setError(e.message || "تعذر جلب البيانات.");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  // Fetch classes when grade changes in modal
  useEffect(() => {
      if (showModal && formData.grade) {
          getAvailableClassesForGrade(formData.grade).then(setExistingClassesForForm);
      } else {
          setExistingClassesForForm([]);
      }
  }, [formData.grade, showModal]);

  const handleRefresh = () => fetchStudents(true);

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.name.includes(searchTerm) || s.studentId.includes(searchTerm) || s.phone.includes(searchTerm)
    );
  }, [students, searchTerm]);

  // --- Bulk Selection ---
  const handleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) setSelectedIds([]);
    else setSelectedIds(filteredStudents.map(s => s.id));
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) setSelectedIds(prev => prev.filter(item => item !== id));
    else setSelectedIds(prev => [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.length} طالب؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    setIsBulkDeleting(true);
    const previousStudents = [...students];
    setStudents(prev => prev.filter(s => !selectedIds.includes(s.id)));
    try {
      await syncStudentsBatch([], [], selectedIds);
      setSelectedIds([]);
    } catch (error) {
      alert("حدث خطأ أثناء الحذف الجماعي.");
      setStudents(previousStudents);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // --- Add / Edit Logic ---
  const openAddModal = () => {
      setIsEditing(false);
      setFormData({ name: '', studentId: '', grade: GRADES[0], className: '', phone: '' });
      setShowModal(true);
  };

  const openEditModal = (student: Student) => {
      setIsEditing(true);
      setCurrentStudentId(student.id);
      setFormData({
          name: student.name,
          studentId: student.studentId,
          grade: student.grade,
          className: student.className,
          phone: student.phone
      });
      setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!isEditing && students.some(s => s.studentId === formData.studentId)) {
        alert("رقم الهوية مسجل مسبقاً لطالب آخر.");
        return;
    }

    if (!formData.className.trim()) {
        alert("يرجى إدخال اسم الفصل.");
        return;
    }

    setLoading(true); 
    try {
      const studentPayload: Student = {
          id: currentStudentId || '', // ID ignored on insert, used on update logic if needed
          ...formData,
          className: formData.className.trim() // Ensure clean string
      };

      if (isEditing) {
          // Update Logic
          await updateStudent(studentPayload);
          setStudents(prev => prev.map(s => s.id === currentStudentId ? { ...s, ...formData } : s));
          alert("تم تعديل بيانات الطالب بنجاح");
      } else {
          // Add Logic
          const addedStudent = await addStudent(studentPayload);
          setStudents(prev => [...prev, addedStudent]);
          alert("تم إضافة الطالب بنجاح");
      }
      setShowModal(false);
    } catch (error) {
      alert("حدث خطأ أثناء الحفظ.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الطالب؟')) {
      const previousStudents = [...students];
      setStudents(prev => prev.filter(s => s.id !== id));
      try {
        await deleteStudent(id);
      } catch (error) {
        alert("فشل الحذف.");
        setStudents(previousStudents);
      }
    }
  };

  // --- Excel Logic ---
  const mapCodeToGrade = (code: string | number): string => {
    const c = code ? code.toString().trim() : '';
    if (c === '725' || c === '0725') return 'الأول متوسط';
    if (c === '825' || c === '0825') return 'الثاني متوسط';
    if (c === '925' || c === '0925') return 'الثالث متوسط';
    if (GRADES.includes(c)) return c;
    return ''; 
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') { alert("مكتبة Excel غير محملة."); return; }

    setProcessingFile(true);
    try {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        
        if (data.length === 0) { alert("الملف فارغ!"); return; }

        const toUpsert: Student[] = [];
        data.forEach((row: any) => {
            const name = row['الاسم'] || row['name'] || row['Name'];
            const studentIdRaw = row['السجل المدني'] || row['الهوية'] || row['studentId'] || row['ID'];
            const gradeRaw = row['الصف'] || row['grade'] || row['Grade'];
            const classRaw = row['الفصل'] || row['className'] || row['Class'];
            const phone = row['الجوال'] || row['رقم الجوال'] || row['phone'] || '';

            if (name && studentIdRaw) {
                toUpsert.push({
                    id: '',
                    name: name.toString().trim(),
                    studentId: studentIdRaw.toString().trim(),
                    grade: mapCodeToGrade(gradeRaw) || GRADES[0],
                    className: classRaw ? classRaw.toString().trim() : '1',
                    phone: phone.toString().trim()
                });
            }
        });

        if (toUpsert.length === 0) { alert("لا توجد بيانات صالحة."); return; }
        
        if (window.confirm(`سيتم معالجة ${toUpsert.length} طالب. متابعة؟`)) {
            await syncStudentsBatch(toUpsert, [], []); 
            await fetchStudents(true); 
            alert("تمت العملية بنجاح!");
        }
    } catch (error: any) { alert(`خطأ: ${error.message}`); } finally { setProcessingFile(false); e.target.value = ''; }
  };

  const inputClasses = "w-full p-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-900 outline-none transition-all font-bold text-sm";
  const labelClasses = "block text-xs font-bold text-slate-500 uppercase mb-1.5";

  return (
    <div className="space-y-6 animate-fade-in relative pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
            <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
                <UserCheck className="text-emerald-500"/> إدارة الطلاب
            </h1>
            <p className="text-slate-500 text-sm mt-1">قاعدة بيانات الطلاب (إضافة، تعديل، حذف، استيراد)</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
           <button onClick={handleRefresh} className="bg-slate-100 text-slate-600 p-2.5 rounded-xl hover:bg-slate-200" title="تحديث"><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
           <button onClick={openAddModal} className="bg-blue-900 text-white px-5 py-2.5 rounded-xl hover:bg-blue-800 font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-900/20"><Plus size={18} /> إضافة طالب</button>
           
           <div className="relative">
             <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" id="excel-upload" disabled={processingFile} />
             <label htmlFor="excel-upload" className={`flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 font-bold text-sm shadow-lg shadow-emerald-600/20 cursor-pointer ${processingFile ? 'opacity-50' : ''}`}>
                {processingFile ? <Loader2 className="animate-spin" size={18} /> : <div className="flex items-center gap-2"><div className="bg-white/20 p-1 rounded"><Plus size={12}/></div> استيراد Excel</div>}
             </label>
           </div>
        </div>
      </div>

      {/* Search & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative">
              <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="بحث بالاسم، الهوية، أو الجوال..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-12 pl-4 py-3 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-slate-700"
              />
          </div>
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-blue-400 uppercase">إجمالي الطلاب</p>
                  <p className="text-2xl font-extrabold text-blue-900">{students.length}</p>
              </div>
              <div className="bg-white p-3 rounded-xl text-blue-600 shadow-sm"><UserCheck size={24}/></div>
          </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-6 animate-fade-in-up border border-slate-700">
           <div className="flex items-center gap-2 font-bold text-sm">
              <div className="bg-white text-slate-900 w-6 h-6 flex items-center justify-center rounded-full text-xs">{selectedIds.length}</div>
              <span>طالب محدد</span>
           </div>
           <div className="h-6 w-px bg-slate-700"></div>
           <button onClick={() => setSelectedIds([])} className="text-slate-400 hover:text-white text-sm font-bold">إلغاء</button>
           <button onClick={handleBulkDelete} disabled={isBulkDeleting} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
             {isBulkDeleting ? <Loader2 className="animate-spin" size={16}/> : <Trash2 size={16} />} حذف المحدد
           </button>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
        {/* Table Header */}
        <div className="flex bg-slate-50/50 text-slate-500 text-xs font-bold border-b border-slate-100 py-4 px-4 uppercase tracking-wider">
            <div className="w-12 text-center flex justify-center">
                <button onClick={handleSelectAll} className="hover:text-blue-600">
                    {selectedIds.length > 0 && selectedIds.length === filteredStudents.length ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20}/>}
                </button>
            </div>
            <div className="w-[30%]">بيانات الطالب</div>
            <div className="w-[20%]">الصف والفصل</div>
            <div className="w-[20%]">بيانات الاتصال</div>
            <div className="w-[15%] text-center">رقم الهوية</div>
            <div className="flex-1 text-center">إجراءات</div>
        </div>

        {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin mb-4" size={40} />
                <p className="font-bold">جاري تحميل قاعدة البيانات...</p>
            </div>
        ) : filteredStudents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12">
                <div className="bg-slate-50 p-6 rounded-full mb-4"><UserCheck size={48} className="opacity-20" /></div>
                <p className="font-bold">لا توجد بيانات مطابقة</p>
                <p className="text-sm mt-1">قم بإضافة طلاب أو استيراد ملف Excel</p>
            </div>
        ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                 {filteredStudents.map((s) => {
                    const isSelected = selectedIds.includes(s.id);
                    return (
                      <div key={s.id} className={`flex items-center border-b border-slate-50 hover:bg-blue-50/30 transition-colors py-3 px-4 text-sm group ${isSelected ? 'bg-blue-50/60' : ''}`}>
                        <div className="w-12 flex justify-center">
                            <button onClick={() => handleSelectOne(s.id)} className={`transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-300 hover:text-slate-500'}`}>
                                {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>
                        </div>
                        <div className="w-[30%] font-bold text-slate-800 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs border border-slate-200">{s.name.charAt(0)}</div>
                            {s.name}
                        </div>
                        <div className="w-[20%] text-slate-600 flex items-center gap-2">
                            <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{s.grade}</span>
                            <span className="text-slate-400">/</span>
                            <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{s.className}</span>
                        </div>
                        <div className="w-[20%] font-mono text-slate-600 dir-ltr text-right flex items-center gap-2">
                            <Smartphone size={14} className="text-slate-400"/> {s.phone || '-'}
                        </div>
                        <div className="w-[15%] text-center font-mono text-slate-500 bg-slate-50 rounded px-2 py-1 text-xs">{s.studentId}</div>
                        <div className="flex-1 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditModal(s)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"><Edit size={16}/></button>
                            <button onClick={() => handleDelete(s.id)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    );
                 })}
            </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                 <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <div className="bg-blue-50 p-2 rounded-xl text-blue-600">{isEditing ? <Edit size={20}/> : <Plus size={20}/>}</div>
                    {isEditing ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
                 </h2>
                 <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 p-2 rounded-full transition-colors"><X size={20}/></button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                 <div>
                   <label className={labelClasses}>الاسم الثلاثي</label>
                   <div className="relative"><input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClasses} placeholder="أدخل اسم الطالب..." /><UserCheck className="absolute left-4 top-3 text-slate-400" size={18}/></div>
                 </div>
                 <div>
                   <label className={labelClasses}>رقم الهوية / السجل</label>
                   <div className="relative"><input required value={formData.studentId} onChange={e => setFormData({...formData, studentId: e.target.value})} className={inputClasses} placeholder="1xxxxxxxxx" /><Hash className="absolute left-4 top-3 text-slate-400" size={18}/></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className={labelClasses}>الصف الدراسي</label>
                       <select value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})} className={inputClasses}>
                          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className={labelClasses}>الفصل (الشعبة)</label>
                       {/* Changed from select to input with datalist to allow creating new classes */}
                       <input 
                         list="classOptions"
                         required
                         value={formData.className}
                         onChange={e => setFormData({...formData, className: e.target.value})}
                         className={inputClasses}
                         placeholder="اكتب الفصل (أ، ب، 1...)"
                       />
                       <datalist id="classOptions">
                          {existingClassesForForm.map(c => <option key={c} value={c} />)}
                       </datalist>
                    </div>
                 </div>
                 <div>
                   <label className={labelClasses}>رقم جوال ولي الأمر</label>
                   <div className="relative"><input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={inputClasses} placeholder="05xxxxxxxx" /><Smartphone className="absolute left-4 top-3 text-slate-400" size={18}/></div>
                 </div>

                 <button type="submit" className="w-full bg-blue-900 text-white py-4 rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg flex items-center justify-center gap-2 mt-4">
                   <Save size={20} /> {isEditing ? 'حفظ التعديلات' : 'إضافة الطالب'}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Students;
