
import { supabase } from '../supabaseClient';
import { SchoolNews, Student, ExcuseRequest, RequestStatus, StaffUser, AttendanceRecord, AttendanceStatus, ClassAssignment, ResolvedAlert, BehaviorRecord, AdminInsight, Referral, StudentObservation, GuidanceSession, StudentPoint, ParentLink, AppNotification } from "../types";
import { GoogleGenAI } from "@google/genai";

// --- Caching System ---
const CACHE: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 Minutes

export const getFromCache = <T>(key: string): T | null => {
  const cached = CACHE[key];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
};

const setCache = (key: string, data: any) => {
  CACHE[key] = { data, timestamp: Date.now() };
};

export const invalidateCache = (key: string) => {
  delete CACHE[key];
};

// --- AI Configuration ---
export interface AIConfig { provider: 'google' | 'openai_compatible'; apiKey: string; baseUrl?: string; model: string; }

export const getAIConfig = (): AIConfig => {
  const stored = localStorage.getItem('ozr_ai_config');
  if (stored) return JSON.parse(stored);
  const envKey = import.meta.env.VITE_GOOGLE_AI_KEY || '';
  return { provider: 'google', apiKey: envKey, model: 'gemini-2.5-flash' };
};

export const generateSmartContent = async (prompt: string, systemInstruction?: string): Promise<string> => {
  const config = getAIConfig();
  if (!config.apiKey) return "عفواً، لم يتم ضبط مفتاح الذكاء الاصطناعي (API Key).";
  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const response = await ai.models.generateContent({ model: config.model, contents: prompt, config: { systemInstruction } });
    return response.text || "";
  } catch (error: any) { 
      console.error("AI Error:", error);
      return "تعذر الاتصال بخدمة الذكاء الاصطناعي."; 
  }
};

// --- SPECIALIZED AI FUNCTIONS ---

// 1. For Admin: Executive School Report
export const generateExecutiveReport = async (stats: any) => {
    const prompt = `
    بصفتك مستشاراً تربويًا وإداريًا خبيراً، قم بإعداد "تقرير تنفيذي شامل" لإدارة المدرسة بناءً على البيانات التالية:
    - نسبة الحضور العامة: ${stats.attendanceRate}%
    - نسبة الغياب: ${stats.absenceRate}%
    - نسبة التأخر: ${stats.latenessRate}%
    - إجمالي المخالفات السلوكية: ${stats.totalViolations}
    - عدد الطلاب في دائرة الخطر (غياب متكرر): ${stats.riskCount}
    - الصف الأكثر غياباً: ${stats.mostAbsentGrade}
    
    المطلوب:
    1. ملخص تنفيذي لحالة الانضباط في المدرسة.
    2. تحليل نقاط الضعف (أين تكمن المشكلة الأكبر؟).
    3. ثلاث توصيات عملية ومحددة للإدارة لتحسين الوضع الأسبوع القادم.
    
    الصيغة: تقرير رسمي مهني، نقاط واضحة، لغة عربية فصحى قوية.
    `;
    return await generateSmartContent(prompt);
};

// 2. For Parent: Smart Student Report
export const generateSmartStudentReport = async (studentName: string, attendance: any[], behavior: any[], points: number) => {
    const absentDays = attendance.filter(a => a.status === 'ABSENT').length;
    const lateDays = attendance.filter(a => a.status === 'LATE').length;
    const behaviorCount = behavior.length;
    
    const prompt = `
    اكتب رسالة تربوية موجهة لولي أمر الطالب "${studentName}".
    البيانات:
    - الغياب: ${absentDays} أيام.
    - التأخر: ${lateDays} أيام.
    - المخالفات السلوكية: ${behaviorCount}.
    - نقاط التميز: ${points}.
    
    الأسلوب:
    - إذا كان الأداء ممتازاً (غياب قليل، نقاط عالية): كن مشجعاً جداً وفخوراً.
    - إذا كان هناك ملاحظات: كن لطيفاً ولكن واضحاً في التنبيه على ضرورة التحسن بأسلوب تربوي غير منفر.
    - اختم بنصيحة قصيرة.
    
    اجعل الرسالة تبدو وكأنها من "المرشد الطلابي الذكي".
    `;
    return await generateSmartContent(prompt);
};

// 3. For Deputy: Behavior Action Suggestion
export const suggestBehaviorAction = async (violationName: string, historyCount: number) => {
    const prompt = `
    طالب قام بمخالفة: "${violationName}".
    هذه هي المرة رقم ${historyCount + 1} التي يرتكب فيها مخالفة.
    
    بناءً على قواعد السلوك والمواظبة المدرسية العامة:
    1. ما هو الإجراء النظامي المقترح؟ (تدرج في العقوبة إذا كان مكرراً).
    2. نصيحة قصيرة يمكن توجيهها للطالب أثناء التحقيق.
    `;
    return await generateSmartContent(prompt);
};

// 4. For Counselor: Case Study
export const generateGuidancePlan = async (studentName: string, history: any) => {
    const prompt = `
    اكتب مسودة "خطة علاجية فردية" للطالب ${studentName}.
    المشاكل المرصودة: ${history}.
    
    المطلوب:
    1. تشخيص مبدئي للمشكلة.
    2. هدف الجلسة الإرشادية القادمة.
    3. خطوتان عمليتان لتعديل السلوك.
    `;
    return await generateSmartContent(prompt);
};

export const analyzeSentiment = async (text: string): Promise<'positive' | 'negative' | 'neutral'> => {
    try {
        const res = await generateSmartContent(`Analyze the sentiment of this text (Student Report). Return ONLY one word: 'positive', 'negative', or 'neutral'. Text: "${text}"`);
        const clean = res.trim().toLowerCase();
        if (clean.includes('positive')) return 'positive';
        if (clean.includes('negative')) return 'negative';
        return 'neutral';
    } catch (e) { return 'neutral'; }
};

// --- Mappers ---
const mapStudentFromDB = (s: any): Student => ({ id: s.id, name: s.name, studentId: s.student_id, grade: s.grade, className: s.class_name, phone: s.phone || '' });
const mapStudentToDB = (s: Student) => ({ name: s.name, student_id: s.studentId, grade: s.grade, class_name: s.className, phone: s.phone });

const mapRequestFromDB = (r: any): ExcuseRequest => ({ id: r.id, studentId: r.student_id, studentName: r.student_name, grade: r.grade, className: r.class_name, date: r.date, reason: r.reason, details: r.details, attachmentName: r.attachment_name, attachmentUrl: r.attachment_url, status: r.status as RequestStatus, submissionDate: r.submission_date });
const mapRequestToDB = (r: ExcuseRequest) => ({ student_id: r.studentId, student_name: r.studentName, grade: r.grade, class_name: r.className, date: r.date, reason: r.reason, details: r.details, attachment_name: r.attachmentName, attachment_url: r.attachmentUrl, status: r.status, submission_date: r.submissionDate });

const mapStaffFromDB = (u: any): StaffUser => ({ id: u.id, name: u.name, passcode: u.passcode, assignments: u.assignments || [], permissions: u.permissions || ['attendance', 'requests', 'reports'] });
const mapStaffToDB = (u: StaffUser) => ({ name: u.name, passcode: u.passcode, assignments: u.assignments || [], permissions: u.permissions || [] });

const mapAttendanceFromDB = (a: any): AttendanceRecord => ({ id: a.id, date: a.date, grade: a.grade, className: a.class_name, staffId: a.staff_id, records: a.records || [] });
const mapAttendanceToDB = (a: AttendanceRecord) => ({ date: a.date, grade: a.grade, class_name: a.className, staff_id: a.staffId, records: a.records });

const mapBehaviorFromDB = (b: any): BehaviorRecord => ({ id: b.id, studentId: b.student_id, studentName: b.student_name, grade: b.grade, className: b.class_name, date: b.date, violationDegree: b.violation_degree, violationName: b.violation_name, articleNumber: b.article_number, actionTaken: b.action_taken, notes: b.notes, staffId: b.staff_id, createdAt: b.created_at, parentViewed: b.parent_viewed, parentFeedback: b.parent_feedback, parentViewedAt: b.parent_viewed_at });
const mapBehaviorToDB = (b: BehaviorRecord) => ({ student_id: b.studentId, student_name: b.studentName, grade: b.grade, class_name: b.className, date: b.date, violation_degree: b.violationDegree, violation_name: b.violationName, article_number: b.articleNumber, action_taken: b.actionTaken, notes: b.notes, staff_id: b.staffId, parent_viewed: b.parentViewed, parent_feedback: b.parentFeedback, parent_viewed_at: b.parentViewedAt });

const mapObservationFromDB = (o: any): StudentObservation => ({ id: o.id, studentId: o.student_id, studentName: o.student_name, grade: o.grade, className: o.class_name, date: o.date, type: o.type, content: o.content, staffId: o.staff_id, staffName: o.staff_name, createdAt: o.created_at, parentViewed: o.parent_viewed, parentFeedback: o.parent_feedback, parentViewedAt: o.parent_viewed_at, sentiment: o.sentiment });
const mapObservationToDB = (o: StudentObservation) => ({ student_id: o.studentId, student_name: o.studentName, grade: o.grade, class_name: o.className, date: o.date, type: o.type, content: o.content, staff_id: o.staffId, staff_name: o.staffName, parent_viewed: o.parentViewed, parent_feedback: o.parentFeedback, parent_viewed_at: o.parentViewedAt, sentiment: o.sentiment });

const mapReferralFromDB = (r: any): Referral => ({ id: r.id, studentId: r.student_id, studentName: r.student_name, grade: r.grade, className: r.class_name, referralDate: r.referral_date, reason: r.reason, status: r.status, referredBy: r.referred_by, notes: r.notes, outcome: r.outcome, createdAt: r.created_at });
const mapReferralToDB = (r: Referral) => ({ student_id: r.studentId, student_name: r.studentName, grade: r.grade, class_name: r.className, referral_date: r.referralDate, reason: r.reason, status: r.status, referred_by: r.referredBy, notes: r.notes, outcome: r.outcome });

const mapInsightFromDB = (i: any): AdminInsight => ({ id: i.id, targetRole: i.target_role, content: i.content, isRead: i.is_read, createdAt: i.created_at });

const mapSessionFromDB = (s: any): GuidanceSession => ({ id: s.id, studentId: s.student_id, studentName: s.student_name, date: s.date, sessionType: s.session_type, topic: s.topic, recommendations: s.recommendations, status: s.status });
const mapSessionToDB = (s: GuidanceSession) => ({ student_id: s.studentId, student_name: s.studentName, date: s.date, session_type: s.sessionType, topic: s.topic, recommendations: s.recommendations, status: s.status });

// --- NEWS SYSTEM ---
export const getSchoolNews = async () => {
    const { data, error } = await supabase.from('news').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map((n: any) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        author: n.author,
        isUrgent: n.is_urgent,
        createdAt: n.created_at
    }));
};

export const addSchoolNews = async (news: Omit<SchoolNews, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('news').insert({
        title: news.title,
        content: news.content,
        author: news.author,
        is_urgent: news.isUrgent
    });
    if (error) throw new Error(error.message);
};

export const deleteSchoolNews = async (id: string) => {
    const { error } = await supabase.from('news').delete().eq('id', id);
    if (error) throw new Error(error.message);
};

// --- PARENT & GAMIFICATION ---
export const linkParentToStudent = async (parentCivilId: string, studentId: string) => {
    const { data } = await supabase.from('parent_links').select('*').eq('parent_civil_id', parentCivilId).eq('student_id', studentId);
    if (data && data.length > 0) return;
    const { error } = await supabase.from('parent_links').insert({ parent_civil_id: parentCivilId, student_id: studentId });
    if (error) throw new Error(error.message);
};

export const getParentChildren = async (parentCivilId: string): Promise<Student[]> => {
    const { data: links, error } = await supabase.from('parent_links').select('student_id').eq('parent_civil_id', parentCivilId);
    if (error) return [];
    if (!links || links.length === 0) return [];
    const studentIds = links.map((l: any) => l.student_id);
    const { data: students, error: err2 } = await supabase.from('students').select('*').in('student_id', studentIds);
    if (err2) return [];
    return students.map(mapStudentFromDB);
};

export const addStudentPoints = async (studentId: string, points: number, reason: string, type: 'behavior' | 'attendance' | 'academic') => {
    const { error } = await supabase.from('student_points').insert({ student_id: studentId, points, reason, type });
    if (error) throw new Error(error.message);
    await createNotification(studentId, 'info', 'نقاط جديدة', `تم إضافة ${points} نقطة لرصيدك: ${reason}`);
};

export const getStudentPoints = async (studentId: string): Promise<{total: number, history: StudentPoint[]}> => {
    const { data, error } = await supabase.from('student_points').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
    if (error) return { total: 0, history: [] };
    const total = data.reduce((sum: number, item: any) => sum + item.points, 0);
    const history = data.map((p: any) => ({ id: p.id, studentId: p.student_id, points: p.points, reason: p.reason, type: p.type, createdAt: p.created_at }));
    return { total, history };
};

export const getTopStudents = async (limit = 5) => {
    const { data, error } = await supabase.from('student_points').select('student_id, points');
    if (error) return [];
    const totals: Record<string, number> = {};
    data.forEach((row: any) => { totals[row.student_id] = (totals[row.student_id] || 0) + row.points; });
    const topIds = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit);
    const result = [];
    for (const [sid, score] of topIds) { const student = await getStudentByCivilId(sid); if (student) result.push({ ...student, points: score }); }
    return result;
};

export const createNotification = async (targetId: string, type: 'alert'|'info'|'success', title: string, message: string) => {
    await supabase.from('notifications').insert({ target_user_id: targetId, type, title, message });
};

export const getNotifications = async (targetId: string) => {
    const { data, error } = await supabase.from('notifications').select('*').eq('target_user_id', targetId).order('created_at', { ascending: false });
    if (error) return [];
    return data.map((n: any) => ({ id: n.id, targetUserId: n.target_user_id, title: n.title, message: n.message, isRead: n.is_read, type: n.type, createdAt: n.created_at }));
};

export const markNotificationRead = async (id: string) => { await supabase.from('notifications').update({ is_read: true }).eq('id', id); };

// --- CORE CRUD ---
export const testSupabaseConnection = async (): Promise<{ success: boolean; message: string }> => { try { const { data, error } = await supabase.from('students').select('count', { count: 'exact', head: true }); if (error) throw error; return { success: true, message: `Connected` }; } catch (error: any) { return { success: false, message: `Failed: ${error.message}` }; } };
export const uploadFile = async (file: File): Promise<string | null> => { const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`; const { error } = await supabase.storage.from('attachments').upload(safeName, file); if (error) throw error; const { data } = supabase.storage.from('attachments').getPublicUrl(safeName); return data.publicUrl; };

export const getStudents = async (force=false) => { if(!force){const c=getFromCache<Student[]>('students');if(c)return c;} const{data}=await supabase.from('students').select('*'); const s=data?.map(mapStudentFromDB)||[]; setCache('students',s); return s; };
export const getStudentsSync = () => getFromCache<Student[]>('students');
export const getStudentByCivilId = async (id: string) => { const{data}=await supabase.from('students').select('*').eq('student_id',id).maybeSingle(); return data?mapStudentFromDB(data):null; };
export const addStudent = async (s: Student) => { const{data,error}=await supabase.from('students').insert(mapStudentToDB(s)).select().single(); if(error)throw error; return mapStudentFromDB(data); };
export const deleteStudent = async (id: string) => { await supabase.from('students').delete().eq('id', id); };
export const syncStudentsBatch = async (add: Student[], upd: Student[], del: string[]) => { if(del.length)await supabase.from('students').delete().in('id', del); const upsert = [...add, ...upd].map(mapStudentToDB); if(upsert.length) await supabase.from('students').upsert(upsert, {onConflict:'student_id'}); };
export const clearStudents = async () => { await supabase.from('students').delete().neq('id','0'); };

export const getRequests = async (force=false) => { if(!force){const c=getFromCache<ExcuseRequest[]>('requests');if(c)return c;} const{data}=await supabase.from('requests').select('*'); const r=data?.map(mapRequestFromDB)||[]; setCache('requests',r); return r; };
export const getRequestsByStudentId = async (id: string) => { const{data}=await supabase.from('requests').select('*').eq('student_id',id); return data?.map(mapRequestFromDB)||[]; };
export const addRequest = async (r: ExcuseRequest) => { await supabase.from('requests').insert(mapRequestToDB(r)); invalidateCache('requests'); };
export const updateRequestStatus = async (id: string, status: RequestStatus) => { await supabase.from('requests').update({status}).eq('id',id); invalidateCache('requests'); };
export const clearRequests = async () => { await supabase.from('requests').delete().neq('id','0'); };

export const getStaffUsers = async (force=false) => { if(!force){const c=getFromCache<StaffUser[]>('staff');if(c)return c;} const{data}=await supabase.from('staff').select('*'); const s=data?.map(mapStaffFromDB)||[]; setCache('staff',s); return s; };
export const getStaffUsersSync = () => getFromCache<StaffUser[]>('staff');
export const addStaffUser = async (u: StaffUser) => { await supabase.from('staff').insert(mapStaffToDB(u)); invalidateCache('staff'); };
export const updateStaffUser = async (u: StaffUser) => { await supabase.from('staff').update(mapStaffToDB(u)).eq('id',u.id); invalidateCache('staff'); };
export const deleteStaffUser = async (id: string) => { await supabase.from('staff').delete().eq('id',id); invalidateCache('staff'); };
export const authenticateStaff = async (pass: string) => { const{data}=await supabase.from('staff').select('*').eq('passcode',pass).maybeSingle(); return data?mapStaffFromDB(data):null; };

export const getAttendanceRecords = async (force=false) => { if(!force){const c=getFromCache<AttendanceRecord[]>('attendance');if(c)return c;} const{data}=await supabase.from('attendance').select('*'); const r=data?.map(mapAttendanceFromDB)||[]; setCache('attendance',r); return r; };
export const getAttendanceRecordForClass = async (date: string, grade: string, className: string) => { const{data}=await supabase.from('attendance').select('*').eq('date',date).eq('grade',grade).eq('class_name',className).maybeSingle(); return data?mapAttendanceFromDB(data):null; };
export const saveAttendanceRecord = async (r: AttendanceRecord) => { const{data}=await supabase.from('attendance').select('id').eq('date',r.date).eq('grade',r.grade).eq('class_name',r.className).maybeSingle(); if(data) await supabase.from('attendance').update({records:r.records}).eq('id',data.id); else await supabase.from('attendance').insert(mapAttendanceToDB(r)); invalidateCache('attendance'); };
export const clearAttendance = async () => { await supabase.from('attendance').delete().neq('id','0'); };
export const getStudentAttendanceHistory = async (id: string, grade: string, cls: string) => { const{data}=await supabase.from('attendance').select('date, records').eq('grade',grade).eq('class_name',cls); if(!data)return[]; const hist:any[]=[]; data.forEach((row:any)=>{const rec=row.records.find((x:any)=>x.studentId===id); if(rec) hist.push({date:row.date, status:rec.status});}); return hist.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()); };
export const getDailyAttendanceReport = async (date: string) => { const{data}=await supabase.from('attendance').select('*').eq('date',date); if(!data)return{totalPresent:0,totalAbsent:0,totalLate:0,details:[]}; let p=0,a=0,l=0,d:any[]=[]; data.forEach((row:any)=>{ row.records.forEach((s:any)=>{ if(s.status==='PRESENT')p++; else if(s.status==='ABSENT')a++; else l++; if(s.status!=='PRESENT') d.push({studentId:s.studentId, studentName:s.studentName, grade:row.grade, className:row.class_name, status:s.status}); }); }); return{totalPresent:p,totalAbsent:a,totalLate:l,details:d}; };
export const getPendingRequestsCountForStaff = async (assigns: ClassAssignment[]) => { if(!assigns.length)return 0; const{data}=await supabase.from('requests').select('grade, class_name').eq('status','PENDING'); if(!data)return 0; return data.filter(r=>assigns.some(a=>a.grade===r.grade&&a.className===r.class_name)).length; };

export const getBehaviorRecords = async (sid?: string) => { let q=supabase.from('behavior_records').select('*'); if(sid)q=q.eq('student_id',sid); const{data}=await q; return data?.map(mapBehaviorFromDB)||[]; };
export const addBehaviorRecord = async (b: BehaviorRecord) => { await supabase.from('behavior_records').insert(mapBehaviorToDB(b)); };
export const updateBehaviorRecord = async (b: BehaviorRecord) => { await supabase.from('behavior_records').update(mapBehaviorToDB(b)).eq('id',b.id); };
export const deleteBehaviorRecord = async (id: string) => { await supabase.from('behavior_records').delete().eq('id',id); };
export const clearBehaviorRecords = async () => { await supabase.from('behavior_records').delete().neq('id','0'); };
export const acknowledgeBehavior = async (id: string, feedback?: string) => { await supabase.from('behavior_records').update({parent_viewed:true, parent_viewed_at:new Date().toISOString(), parent_feedback:feedback}).eq('id',id); };

export const getStudentObservations = async (sid?: string) => { let q=supabase.from('observations').select('*'); if(sid)q=q.eq('student_id',sid); const{data, error}=await q; if(error && error.code==='42P01') return []; return data?.map(mapObservationFromDB)||[]; };
export const addStudentObservation = async (o: StudentObservation) => { await supabase.from('observations').insert(mapObservationToDB(o)); };
export const updateStudentObservation = async (id: string, content: string, type: string) => { await supabase.from('observations').update({content,type}).eq('id',id); };
export const deleteStudentObservation = async (id: string) => { await supabase.from('observations').delete().eq('id',id); };
export const clearStudentObservations = async () => { await supabase.from('observations').delete().neq('id','0'); };
export const acknowledgeObservation = async (id: string, feedback?: string) => { await supabase.from('observations').update({parent_viewed:true, parent_viewed_at:new Date().toISOString(), parent_feedback:feedback}).eq('id',id); };

export const getAdminInsights = async (role: string) => { const{data}=await supabase.from('admin_insights').select('*').eq('target_role',role); return data?.map(mapInsightFromDB)||[]; };
export const sendAdminInsight = async (role: string, content: string) => { await supabase.from('admin_insights').insert({target_role:role, content}); };
export const clearAdminInsights = async () => { await supabase.from('admin_insights').delete().neq('id','0'); };

export const getReferrals = async (sid?: string) => { let q=supabase.from('referrals').select('*'); if(sid)q=q.eq('student_id',sid); const{data, error}=await q; if(error&&error.code==='42P01')return[]; return data?.map(mapReferralFromDB)||[]; };
export const addReferral = async (r: Referral) => { const{error}=await supabase.from('referrals').insert(mapReferralToDB(r)); if(error && error.code==='42P01') throw new Error("Table not found"); };
export const updateReferralStatus = async (id: string, status: string, outcome?: string) => { const u:any={status}; if(outcome)u.outcome=outcome; await supabase.from('referrals').update(u).eq('id',id); };
export const clearReferrals = async () => { await supabase.from('referrals').delete().neq('id','0'); };

export const getGuidanceSessions = async (sid?: string) => { let q=supabase.from('guidance_sessions').select('*'); if(sid)q=q.eq('student_id',sid); const{data, error}=await q; if(error&&error.code==='42P01')return[]; return data?.map(mapSessionFromDB)||[]; };
export const addGuidanceSession = async (s: GuidanceSession) => { const{error}=await supabase.from('guidance_sessions').insert(mapSessionToDB(s)); if(error && error.code==='42P01') throw new Error("Table not found"); };

export const resolveAbsenceAlert = async (sid: string, action: string) => { const today=new Date().toISOString().split('T')[0]; try{await supabase.from('risk_resolutions').insert({student_id:sid, resolution_date:today, action_type:action}); if(action==='counselor'){const s=await getStudentByCivilId(sid); if(s) await addReferral({id:'', studentId:s.studentId, studentName:s.name, grade:s.grade, className:s.className, referralDate:today, reason:'غياب متصل', status:'pending', referredBy:'deputy'});}}catch(e){console.error(e);} };
export const getConsecutiveAbsences = async () => { const today=new Date().toISOString().split('T')[0]; const[all, students, resolutions, refs]=await Promise.all([getAttendanceRecords(), getStudents(), supabase.from('risk_resolutions').select('*').eq('resolution_date',today), getReferrals()]); const resolvedIds=new Set(resolutions.data?.map((r:any)=>r.student_id)||[]); const activeRefIds=new Set(refs.filter(r=>r.status==='pending'||r.status==='in_progress').map(r=>r.studentId)); const map:any={}; all.forEach(r=>{r.records.forEach(s=>{const id=s.studentId||students.find(x=>x.name===s.studentName)?.studentId; if(id){if(!map[id])map[id]=[]; map[id].push({date:r.date, status:s.status});} });}); const alerts:any[]=[]; Object.entries(map).forEach(([sid, recs]:[string, any])=>{ if(resolvedIds.has(sid)||activeRefIds.has(sid))return; recs.sort((a:any,b:any)=>new Date(b.date).getTime()-new Date(a.date).getTime()); if(recs.length>=2 && recs[0].status==='ABSENT' && recs[1].status==='ABSENT'){const st=students.find(x=>x.studentId===sid); if(st) alerts.push({studentId:sid, studentName:st.name, days:2, lastDate:recs[0].date});} }); return alerts; };
export const getAvailableClassesForGrade = async (grade: string): Promise<string[]> => { const s = await getStudents(); const c = new Set<string>(); s.forEach(x => { if (x.grade === grade && x.className) c.add(x.className); }); return Array.from(c).sort(); };
