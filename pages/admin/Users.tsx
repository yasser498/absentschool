
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, UserCheck, School, X, CheckSquare, Square, Loader2, RefreshCw, Edit, KeyRound, ShieldCheck, ChevronRight, Check, Lock } from 'lucide-react';
import { getStaffUsersSync, getStaffUsers, addStaffUser, updateStaffUser, deleteStaffUser, getAvailableClassesForGrade } from '../../services/storage';
import { StaffUser, ClassAssignment } from '../../types';
import { GRADES, PERMISSIONS } from '../../constants';

const Users: React.FC = () => {
  // Use synchronous getter for instant load if available
  const [users, setUsers] = useState<StaffUser[]>(() => getStaffUsersSync() || []);
  const [loading, setLoading] = useState(() => !getStaffUsersSync());
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  
  // New User Form State
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  
  // Assignment State
  const [selectedGrade, setSelectedGrade] = useState('');
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedClassesForGrade, setSelectedClassesForGrade] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);

  const fetchUsers = async () => {
    // Only show loading if we didn't have cache
    if (users.length === 0) setLoading(true);
    try {
      const usersData = await getStaffUsers();
      setUsers(usersData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch classes dynamically when grade changes
  useEffect(() => {
    if (!selectedGrade) {
      setAvailableClasses([]);
      return;
    }

    const loadClasses = async () => {
      setLoadingClasses(true);
      try {
        const classes = await getAvailableClassesForGrade(selectedGrade);
        setAvailableClasses(classes);
      } catch (e) {
        console.error("Failed to load classes", e);
      } finally {
        setLoadingClasses(false);
      }
    };
    loadClasses();
  }, [selectedGrade]);


  const handleToggleClass = (className: string) => {
    if (selectedClassesForGrade.includes(className)) {
      setSelectedClassesForGrade(prev => prev.filter(c => c !== className));
    } else {
      setSelectedClassesForGrade(prev => [...prev, className]);
    }
  };

  const handleTogglePermission = (key: string) => {
    if (selectedPermissions.includes(key)) {
        setSelectedPermissions(prev => prev.filter(p => p !== key));
    } else {
        setSelectedPermissions(prev => [...prev, key]);
    }
  };

  const addAssignments = () => {
    if (!selectedGrade || selectedClassesForGrade.length === 0) return;
    
    const newAssignments = selectedClassesForGrade.map(c => ({
      grade: selectedGrade,
      className: c
    }));

    // Filter out duplicates
    const uniqueAssignments = newAssignments.filter(newA => 
      !assignments.some(existingA => existingA.grade === newA.grade && existingA.className === newA.className)
    );

    setAssignments([...assignments, ...uniqueAssignments]);
    setSelectedClassesForGrade([]); // Reset checkboxes
  };

  const removeAssignment = (index: number) => {
    const updated = [...assignments];
    updated.splice(index, 1);
    setAssignments(updated);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setName('');
    setPasscode('');
    setAssignments([]);
    // Default permissions for new user: Attendance, Requests, Reports
    setSelectedPermissions(['attendance', 'requests', 'reports']);
    setSelectedGrade('');
    setSelectedClassesForGrade([]);
    setShowAddModal(true);
  };

  const openEditModal = (user: StaffUser) => {
    setEditingUser(user);
    setName(user.name);
    setPasscode(user.passcode);
    setAssignments(user.assignments || []);
    setSelectedPermissions(user.permissions || ['attendance', 'requests', 'reports']);
    setSelectedGrade('');
    setSelectedClassesForGrade([]);
    setShowAddModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (users.some(u => u.passcode === passcode && u.id !== editingUser?.id)) {
      alert("رمز الدخول هذا مستخدم بالفعل، الرجاء اختيار رمز آخر.");
      return;
    }

    if (assignments.length === 0 && selectedPermissions.length === 0) {
      alert("يجب تخصيص صلاحية واحدة أو فصل دراسي واحد على الأقل.");
      return;
    }

    setSaving(true);
    try {
      // Ensure plain objects
      const cleanAssignments = assignments.map(a => ({
        grade: a.grade,
        className: a.className
      }));

      if (editingUser) {
        // Update
        const updatedUser: StaffUser = {
          ...editingUser,
          name: name,
          passcode: passcode,
          assignments: cleanAssignments,
          permissions: selectedPermissions,
        };
        await updateStaffUser(updatedUser);
      } else {
        // Create
        const newUser: StaffUser = {
          id: '', // Will be generated
          name: name,
          passcode: passcode,
          assignments: cleanAssignments,
          permissions: selectedPermissions,
        };
        await addStaffUser(newUser);
      }

      // Refresh user list
      const updatedUsers = await getStaffUsers(true);
      setUsers(updatedUsers);

      setShowAddModal(false);
      
      // Reset form
      setName(''); setPasscode(''); setAssignments([]); setSelectedPermissions([]);
    } catch (error: any) {
      console.error("Error saving user:", error);
      const errorMessage = error?.message || "خطأ غير معروف";
      alert(`حدث خطأ أثناء حفظ المستخدم: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      try {
        await deleteStaffUser(id);
        const updatedUsers = await getStaffUsers(true);
        setUsers(updatedUsers);
      } catch (error: any) {
        alert(`فشل الحذف: ${error.message || 'خطأ غير معروف'}`);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.includes(searchTerm)
  );

  const inputClasses = "w-full p-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none transition-all font-medium";
  const labelClasses = "block text-sm font-bold text-slate-700 mb-2";

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
           <Loader2 className="animate-spin text-blue-900 mb-4" size={48} />
           <p className="text-slate-500 font-bold">جاري تحميل بيانات المستخدمين...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      
      {/* Header */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-blue-50 to-transparent pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900 flex items-center gap-3">
             <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                <ShieldCheck size={28} />
             </div>
             إدارة المعلمين والمستخدمين
          </h1>
          <p className="text-slate-500 mt-2 text-sm md:text-base max-w-lg">
             التحكم بصلاحيات الدخول وإسناد الفصول الدراسية للمعلمين والمشرفين.
          </p>
        </div>
        <div className="relative z-10 w-full md:w-auto">
            <button 
            onClick={openAddModal}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-900 text-white px-6 py-3.5 rounded-xl hover:bg-blue-800 transition-all font-bold shadow-lg shadow-blue-900/20 active:scale-95 group"
            >
            <div className="bg-white/10 p-1 rounded-lg group-hover:bg-white/20 transition-colors">
                <Plus size={20} />
            </div>
            <span>إضافة مستخدم جديد</span>
            </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl mx-auto md:mx-0">
         <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <Search className="text-slate-400" size={20} />
         </div>
         <input 
            type="text" 
            placeholder="ابحث باسم المعلم أو المشرف..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none text-slate-800 shadow-sm transition-all text-base"
         />
      </div>

      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center gap-3 text-sm text-blue-800">
          <div className="bg-white p-2 rounded-lg text-blue-600 shadow-sm"><Lock size={16}/></div>
          <p>ملاحظة: حساب <strong>مدير النظام (Admin)</strong> الرئيسي ثابت ولا يظهر في هذه القائمة لضمان الأمان. يمكنك فقط إدارة المعلمين والمشرفين هنا.</p>
      </div>

      {/* Users Grid */}
      {filteredUsers.length === 0 ? (
         <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
               <UserCheck size={48} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-700">لا يوجد مستخدمين</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-2">قم بإضافة معلمين ومشرفين لتتمكن من إسناد الفصول لهم</p>
         </div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map(u => (
               <div key={u.id} className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300 flex flex-col relative overflow-hidden">
                  
                  {/* Card Decoration */}
                  <div className="h-2 w-full bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                  <div className="p-6 flex-1 flex flex-col gap-5">
                     
                     {/* Header: Info & Actions */}
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 rounded-2xl bg-slate-50 text-blue-900 border border-slate-100 flex items-center justify-center font-bold text-xl shadow-inner">
                              {u.name.charAt(0)}
                           </div>
                           <div>
                              <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-900 transition-colors">{u.name}</h3>
                              <p className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full w-fit mt-1">
                                {u.permissions?.includes('students') ? 'موجه طلابي / إداري' : 'طاقم تدريس'}
                              </p>
                           </div>
                        </div>
                        
                        {/* Actions Menu (Hover) */}
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 translate-x-0 md:translate-x-4 md:group-hover:translate-x-0">
                           <button 
                              onClick={() => openEditModal(u)} 
                              className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                              title="تعديل"
                           >
                              <Edit size={18}/>
                           </button>
                           <button 
                              onClick={() => handleDelete(u.id)} 
                              className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              title="حذف"
                           >
                              <Trash2 size={18}/>
                           </button>
                        </div>
                     </div>

                     {/* Passcode Area */}
                     <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between group-hover:bg-blue-50/40 transition-colors">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                           <KeyRound size={16} />
                           رمز الدخول
                        </div>
                        <span className="font-mono text-xl font-bold text-slate-800 tracking-[0.2em] bg-white px-4 py-1 rounded-lg border border-slate-200 shadow-sm">
                           {u.passcode}
                        </span>
                     </div>
                     
                     {/* Permissions Tag Cloud */}
                     <div className="flex flex-wrap gap-1.5">
                        {u.permissions?.includes('attendance') && <span className="text-[10px] px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md font-bold">رصد الغياب</span>}
                        {u.permissions?.includes('requests') && <span className="text-[10px] px-2 py-1 bg-amber-50 text-amber-700 rounded-md font-bold">الأعذار</span>}
                        {u.permissions?.includes('students') && <span className="text-[10px] px-2 py-1 bg-purple-50 text-purple-700 rounded-md font-bold">دليل الطلاب</span>}
                        {u.permissions?.includes('deputy') && <span className="text-[10px] px-2 py-1 bg-red-50 text-red-700 rounded-md font-bold">الوكيل</span>}
                        {u.permissions?.includes('reports') && <span className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-bold">التقارير</span>}
                     </div>

                     {/* Assignments List */}
                     <div className="flex-1 border-t border-slate-50 pt-3 mt-1">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1.5 pl-1">
                           <School size={14} /> 
                           الفصول المسندة ({u.assignments?.length || 0})
                        </p>
                        <div className="flex flex-wrap gap-2">
                           {u.assignments && u.assignments.length > 0 ? (
                              u.assignments.slice(0, 5).map((a, idx) => (
                                 <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {a.grade} <span className="opacity-30">|</span> {a.className}
                                 </span>
                              ))
                           ) : (
                              <span className="text-slate-400 text-xs italic bg-slate-50 px-3 py-1.5 rounded-lg w-full text-center">لا يوجد فصول مسندة</span>
                           )}
                           {u.assignments && u.assignments.length > 5 && (
                              <span className="inline-flex items-center justify-center w-8 h-7 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200" title="المزيد">
                                 +{u.assignments.length - 5}
                              </span>
                           )}
                        </div>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-0 animate-fade-in-up border border-slate-100 relative max-h-[90vh] flex flex-col overflow-hidden">
              
              {/* Modal Header */}
              <div className="p-6 md:p-8 bg-gradient-to-br from-white to-slate-50 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                 <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl text-white shadow-lg shadow-blue-900/10 ${editingUser ? 'bg-amber-500' : 'bg-blue-600'}`}>
                           {editingUser ? <Edit size={24}/> : <Plus size={24}/>}
                        </div>
                        {editingUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 mr-14">قم بتعبئة بيانات المعلم وتحديد الصلاحيات والفصول.</p>
                 </div>
                 <button onClick={() => setShowAddModal(false)} className="bg-white p-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm border border-slate-100">
                    <X size={20} />
                 </button>
              </div>
              
              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                 <form id="userForm" onSubmit={handleSaveUser} className="space-y-8">
                    {/* Basic Info Section */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className={labelClasses}>اسم المعلم / المشرف</label>
                        <div className="relative">
                           <input required value={name} onChange={e => setName(e.target.value)} className={inputClasses} placeholder="مثال: أ. محمد عبدالله" />
                           <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                        </div>
                      </div>
                      <div className="space-y-2">
                         <label className={labelClasses}>رمز الدخول (رقم سري)</label>
                         <div className="relative">
                           <input required value={passcode} onChange={e => setPasscode(e.target.value)} className={inputClasses} placeholder="مثال: 1234" />
                           <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                         </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100"></div>

                    {/* Permissions Section */}
                    <div>
                        <div className="flex items-center gap-2 text-blue-900 font-bold text-lg mb-4">
                            <ShieldCheck className="text-blue-500" />
                            <h3>صلاحيات الوصول والشاشات</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {PERMISSIONS.map(p => {
                                const isChecked = selectedPermissions.includes(p.key);
                                return (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => handleTogglePermission(p.key)}
                                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isChecked ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isChecked ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}`}>
                                                {isChecked && <Check size={14} className="text-white" />}
                                            </div>
                                            <span className={`font-bold text-sm ${isChecked ? 'text-blue-900' : 'text-slate-600'}`}>{p.label}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="border-t border-slate-100"></div>

                    {/* Assignments Builder */}
                    <div className="space-y-6">
                       <div className="flex items-center gap-2 text-blue-900 font-bold text-lg">
                          <School className="text-blue-500" />
                          <h3>إسناد الفصول الدراسية</h3>
                       </div>

                       <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-6 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500 opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

                          <div className="grid md:grid-cols-2 gap-6">
                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">1. اختر الصف الدراسي</label>
                                <select 
                                  value={selectedGrade} 
                                  onChange={e => { setSelectedGrade(e.target.value); setSelectedClassesForGrade([]); }} 
                                  className={inputClasses}
                                >
                                   <option value="">-- اختر الصف --</option>
                                   {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                             </div>
                             
                             <div className="flex items-end">
                                <div className="w-full">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                       2. حدد الفصول (الشعب)
                                    </label>
                                    {!selectedGrade ? (
                                       <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-3 text-center text-slate-400 text-sm">
                                          يرجى اختيار الصف أولاً
                                       </div>
                                    ) : loadingClasses ? (
                                        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white p-3 rounded-xl border border-slate-200">
                                            <Loader2 className="animate-spin text-blue-600" size={16} /> جاري جلب الشعب...
                                        </div>
                                    ) : availableClasses.length > 0 ? (
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap gap-2 min-h-[52px]">
                                            {availableClasses.map(cls => {
                                                const isSelected = selectedClassesForGrade.includes(cls);
                                                return (
                                                    <button
                                                        key={cls}
                                                        type="button"
                                                        onClick={() => handleToggleClass(cls)}
                                                        className={`
                                                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-sm
                                                        ${isSelected 
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' 
                                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-white'}
                                                        `}
                                                    >
                                                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                        <span className="font-bold">{cls}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="bg-amber-50 text-amber-700 text-sm p-3 rounded-xl border border-amber-100 flex items-center gap-2">
                                            <RefreshCw size={16}/> لا توجد فصول مسجلة لهذا الصف.
                                        </div>
                                    )}
                                </div>
                             </div>
                          </div>

                          <div className="flex justify-end">
                              <button 
                                type="button"
                                onClick={addAssignments}
                                disabled={selectedClassesForGrade.length === 0}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
                              >
                                <Plus size={18} />
                                إضافة الفصول المحددة للقائمة
                              </button>
                          </div>
                       </div>
                    </div>

                    {/* Selected Assignments List */}
                    <div>
                       <label className={labelClasses}>الفصول التي تم إسنادها ({assignments.length})</label>
                       <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[120px] max-h-[200px] overflow-y-auto custom-scrollbar shadow-inner">
                          {assignments.length > 0 ? (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {assignments.map((assign, idx) => (
                                   <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm group hover:border-blue-200 transition-colors">
                                      <div className="flex items-center gap-3">
                                         <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                                            <School size={18} />
                                         </div>
                                         <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-800">{assign.grade}</span>
                                            <span className="text-xs text-slate-500">فصل (شعبة) {assign.className}</span>
                                         </div>
                                      </div>
                                      <button 
                                        type="button" 
                                        onClick={() => removeAssignment(idx)}
                                        className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                        title="إزالة"
                                      >
                                         <Trash2 size={18} />
                                      </button>
                                   </div>
                                ))}
                             </div>
                          ) : (
                             <div className="h-full flex flex-col items-center justify-center text-slate-400 py-6">
                                <School size={32} className="opacity-30 mb-2"/>
                                <p className="text-sm">لم يتم إضافة أي فصول بعد.</p>
                             </div>
                          )}
                       </div>
                    </div>
                 </form>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 z-10 flex gap-4">
                 <button 
                   type="submit" 
                   form="userForm"
                   disabled={saving}
                   className="flex-1 bg-blue-900 text-white py-4 rounded-xl hover:bg-blue-800 font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-95"
                 >
                   {saving ? <Loader2 className="animate-spin" /> : <><CheckSquare size={20} /> {editingUser ? 'حفظ التعديلات' : 'حفظ المستخدم'}</>}
                 </button>
                 <button 
                   type="button" 
                   onClick={() => setShowAddModal(false)} 
                   className="flex-1 bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-xl hover:bg-slate-50 hover:border-slate-300 font-bold transition-all active:scale-95"
                 >
                   إلغاء
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Users;