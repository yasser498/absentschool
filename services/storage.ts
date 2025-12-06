
import { supabase } from '../supabaseClient';
import { 
  Appointment, AppointmentSlot, 
  SchoolNews, Student, ExcuseRequest, RequestStatus, StaffUser, AttendanceRecord, AttendanceStatus, ClassAssignment, ResolvedAlert, BehaviorRecord, AdminInsight, Referral, StudentObservation, GuidanceSession, StudentPoint, ParentLink, AppNotification, ExitPermission 
} from "../types";
import { GoogleGenAI } from "@google/genai";

// --- Caching System ---
const CACHE: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 Minutes

export function getFromCache<T>(key: string): T | null {
  const cached = CACHE[key];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

const setCache = (key: string, data: any) => {
  CACHE[key] = { data, timestamp: Date.now() };
};

export const invalidateCache = (key: string) => {
  delete CACHE[key];
};

// --- AI Configuration ---
export interface AIConfig { provider: 'google' | 'openai_compatible'; apiKey: string; baseUrl?: string; model: string; }

// Hardcoded fallback to ensure immediate operation as per user request
const FALLBACK_KEY = "AIzaSyBeIsIrMvAA3dSRPxuSsxpJ0fzo3V8EuYk";

export const getAIConfig = async (): Promise<AIConfig> => {
  // 1. Check LocalStorage (For Admin Override/Testing)
  const stored = localStorage.getItem('ozr_ai_config');
  if (stored) return JSON.parse(stored);

  let apiKey = '';
  let provider = 'google';
  let model = 'gemini-3-pro-preview';

  // 2. Try fetching from Supabase System Settings (Dynamic Configuration)
  try {
      const { data } = await supabase.from('system_settings').select('key, value').in('key', ['ai_api_key', 'ai_provider', 'ai_model']);
      if (data && data.length > 0) {
          const settings: Record<string, string> = {};
          data.forEach((row: any) => settings[row.key] = row.value);
          
          if (settings.ai_api_key) apiKey = settings.ai_api_key;
          if (settings.ai_provider) provider = settings.ai_provider;
          if (settings.ai_model) model = settings.ai_model;
      }
  } catch (e) {
      // Silent fail on DB, will fall through to other methods
      console.debug('Failed to fetch system settings', e);
  }

  // 3. Try Environment Variables
  if (!apiKey) {
      try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env?.API_KEY) {
            // @ts-ignore
            apiKey = process.env.API_KEY;
        }
      } catch (e) { }
  }

  // 4. Final Fallback (Hardcoded Key)
  if (!apiKey) {
      apiKey = FALLBACK_KEY;
  }

  return { provider: provider as any, apiKey, model };
};

export const generateSmartContent = async (prompt: string, systemInstruction?: string, modelOverride?: string): Promise<string> => {
  try {
    const config = await getAIConfig();
    
    if (!config.apiKey) {
        console.warn("AI Feature Skipped: API Key is missing.");
        return "عذراً، خدمة الذكاء الاصطناعي غير مفعلة حالياً.";
    }

    // --- Google Gemini Provider ---
    if (config.provider === 'google') {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const targetModel = modelOverride || config.model || 'gemini-3-pro-preview';
        
        const genConfig: any = { systemInstruction };
        
        // Optimize thinking budget based on model family
        if (targetModel.includes('flash')) {
            genConfig.thinkingConfig = { thinkingBudget: 0 }; 
        } else {
            // Default thinking budget for Pro models
            genConfig.thinkingConfig = { thinkingBudget: 1024 }; 
        }

        const response = await ai.models.generateContent({ 
            model: targetModel, 
            contents: prompt, 
            config: genConfig
        });
        return response.text || "";
    }

    // --- OpenAI / DeepSeek Provider (Future Expansion) ---
    if (config.provider === 'openai_compatible') {
        // This block is ready for future implementation of DeepSeek/GPT via standard OpenAI-like API
        // You would use fetch() here to call the endpoint defined in config.baseUrl
        return "تم إعداد النظام لدعم هذا المزود، ولكن لم يتم تفعيله بعد.";
    }

    return "";
  } catch (error: any) { 
      console.error("AI Error:", error);
      if (error.message && error.message.includes('429')) {
          return "عذراً، النظام مشغول جداً حالياً (تجاوز الحد المسموح للاستخدام اليومي). يرجى المحاولة لاحقاً.";
      }
      return "تعذر الاتصال بخدمة الذكاء الاصطناعي."; 
  }
};

// Helper to get Counselor Name
const getCounselorName = async () => {
    const { data } = await supabase.from('staff').select('name, permissions');
    if (!data) return "الموجه الطلابي";
    const counselors = data.filter((u: any) => u.permissions && u.permissions.includes('students'));
    if (counselors.length > 0) {
        const randomCounselor = counselors[Math.floor(Math.random() * counselors.length)];
        return randomCounselor.name;
    }
    return "الموجه الطلابي";
};

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

export const generateSmartStudentReport = async (studentName: string, attendance: any[], behavior: any[], points: number) => {
    const absentDays = attendance.filter(a => a.status === 'ABSENT').length;
    const lateDays = attendance.filter(a => a.status === 'LATE').length;
    const behaviorCount = behavior.length;
    const counselorName = await getCounselorName();
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
    
    التوقيع في نهاية الرسالة يجب أن يكون حرفياً كالتالي:
    الموجه الطلابي
    ${counselorName}
    `;
    return await generateSmartContent(prompt);
};

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

export const generateGuidancePlan = async (studentName: string, history: any) => {
    const counselorName = await getCounselorName();
    const prompt = `
    بصفتك خبيراً تربوياً، قم بإعداد "خطة علاجية فردية" رسمية وجاهزة للطباعة للطالب: ${studentName}.
    
    سياق الحالة والملاحظات: ${history}.
    
    المطلوب:
    اكتب الخطة مباشرة بصيغة رسمية (بدون مقدمات مثل "إليك المسودة").
    الهيكل المطلوب:
    1. التشخيص التربوي (صياغة مهنية للمشكلة).
    2. الأهداف السلوكية (ما نريد تحقيقه).
    3. الإجراءات العلاجية (خطوات عملية محددة للمعلم وولي الأمر والطالب).
    4. التوصيات الختامية.

    استخدم لغة عربية فصحى رسمية جداً، بصيغة المتكلم (الموجه الطلابي).
    `;
    return await generateSmartContent(prompt);
};

// --- NEW CASE STUDY AI GENERATION ---
export const generateCaseStudyAnalysis = async (
    studentName: string, 
    age: string, 
    summary: string,
    records?: { absence: number, late: number, violations: number, observations: string[] }
) => {
    let contextStr = "";
    if (records) {
        contextStr = `
        بيانات الطالب من السجلات المدرسية:
        - عدد أيام الغياب: ${records.absence}
        - عدد مرات التأخر: ${records.late}
        - عدد المخالفات السلوكية: ${records.violations}
        - أبرز ملاحظات المعلمين: ${records.observations.length > 0 ? records.observations.join(" | ") : "لا يوجد"}
        `;
    }

    const prompt = `
    بصفتك خبير في علم النفس التربوي والتوجيه الطلابي، قم بتحليل حالة الطالب: ${studentName} (${age}).
    
    ${contextStr}

    ملخص المشكلة المدخل من الموجه: "${summary}"

    المطلوب: قم بتوليد محتوى احترافي ومفصل للحقول التالية بدقة متناهية، ويجب أن يكون الناتج بصيغة JSON فقط:
    {
      "description": "1. وصف المشكلة بشكل علمي دقيق وتفصيلي (اربط الوصف بسجلات الغياب والسلوك إن وجدت علاقة قوية)",
      "initialDiagnosis": "2. الأفكار التشخيصية الأولية (نقاط مرقمة)",
      "diagnosisIntro": "3. مقدمة العبارة التشخيصية (السياق العام للحالة)",
      "diagnosisCore": "4. جوهر العبارة التشخيصية (تحليل الأسباب الذاتية والبيئية بعمق، مع استحضار أثر الغياب/المخالفات المذكورة في السجل)",
      "diagnosisConclusion": "5. خاتمة العبارة التشخيصية (ملخص مكثف للوضع)",
      "therapeuticGoal": "6. الهدف العلاجي (ما نسعى لتحقيقه بدقة)",
      "treatmentPlan": "7. الخطة العلاجية (خطوات مفصلة: العلاج الذاتي، العلاج البيئي، دور الأسرة، دور المدرسة. يجب تضمين إجراءات خاصة لمعالجة الغياب أو السلوك إذا كانت الأرقام في السجل مرتفعة)",
      "notes": "8. ملاحظات وتوصيات إضافية حول الحالة"
    }

    ملاحظة: استخدم لغة عربية فصحى متخصصة في علم النفس والتوجيه. لا تضف أي نص خارج كائن JSON.
    `;
    
    const content = await generateSmartContent(prompt);
    try {
        // Cleanup response if it contains markdown code blocks
        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanContent);
    } catch (e) {
        console.error("Failed to parse AI JSON", e);
        return null;
    }
};

export const generateUserSpecificBotContext = async (): Promise<{role: string, context: string}> => {
    const news = await getSchoolNews();
    const generalInfo = await getBotContext();
    const newsText = news.slice(0, 3).map(n => `- خبر: ${n.title} (${n.content})`).join('\n');
    let baseContext = `
    معلومات عامة عن المدرسة:
    ${generalInfo || "الدوام: 7:00 ص - 1:15 م."}
    آخر الأخبار:
    ${newsText}
    `;
    const adminSession = localStorage.getItem('ozr_admin_session');
    const staffSession = localStorage.getItem('ozr_staff_session');
    const parentId = localStorage.getItem('ozr_parent_id');

    if (adminSession) {
        const requests = await getRequests();
        const pendingCount = requests.filter(r => r.status === 'PENDING').length;
        const risks = await getConsecutiveAbsences();
        return {
            role: 'مدير النظام (Admin)',
            context: `
            ${baseContext}
            أنت مساعد شخصي لمدير المدرسة.
            حالة النظام الحالية:
            - يوجد ${pendingCount} طلب عذر معلق يحتاج للمراجعة.
            - يوجد ${risks.length} طلاب في دائرة الخطر (غياب متصل لأكثر من 3 أيام).
            - جميع الصلاحيات متاحة لك في لوحة التحكم.
            الطلاب في دائرة الخطر:
            ${risks.map(r => `${r.studentName} (${r.days} أيام)`).join(', ')}
            `
        };
    }
    if (staffSession) {
        const user: StaffUser = JSON.parse(staffSession);
        const perms = user.permissions || [];
        let roleName = 'معلم';
        let specificData = '';
        if (perms.includes('deputy')) {
            roleName = 'وكيل شؤون الطلاب';
            const behaviors = await getBehaviorRecords();
            const todayViolations = behaviors.filter(b => b.date === new Date().toISOString().split('T')[0]).length;
            const risks = await getConsecutiveAbsences();
            specificData = `
            - مخالفات اليوم المسجلة: ${todayViolations}.
            - طلاب في خطر الغياب المتصل: ${risks.length}.
            - يمكنك تسجيل مخالفات واستدعاء أولياء الأمور.`;
        } else if (perms.includes('students')) {
            roleName = 'الموجه الطلابي';
            const referrals = await getReferrals();
            const pendingRefs = referrals.filter(r => r.status === 'pending').length;
            specificData = `- لديك ${pendingRefs} إحالة جديدة من المعلمين/الوكيل تحتاج لمعالجة.\n- يمكنك تسجيل جلسات إرشادية.`;
        } else {
            const assignments = user.assignments || [];
            const classesText = assignments.map(a => `${a.grade} ${a.className}`).join(', ');
            specificData = `- الفصول المسندة إليك: ${classesText}.\n- يمكنك رصد الغياب ورفع الملاحظات السلوكية لطلاب هذه الفصول.`;
        }
        return {
            role: roleName,
            context: `
            ${baseContext}
            أنت مساعد شخصي لـ ${roleName} واسمه ${user.name}.
            بيانات خاصة بمهامه:
            ${specificData}
            `
        };
    }
    if (parentId) {
        const children = await getParentChildren(parentId);
        let childrenDetails = "";
        for (const child of children) {
            const history = await getStudentAttendanceHistory(child.studentId, child.grade, child.className);
            const absentDays = history.filter(h => h.status === 'ABSENT').length;
            const points = (await getStudentPoints(child.studentId)).total;
            childrenDetails += `- الابن: ${child.name} (الصف: ${child.grade}). غياب: ${absentDays} يوم. نقاط تميز: ${points}.\n`;
        }
        return {
            role: 'ولي أمر',
            context: `
            ${baseContext}
            أنت مساعد لولي أمر.
            بيانات أبنائه:
            ${childrenDetails || "لا يوجد أبناء مرتبطين حالياً. ساعده في طريقة ربط الأبناء عبر رقم الهوية."}
            إذا سأل عن ابنه، أجب بناءً على البيانات أعلاه.
            `
        };
    }
    return {
        role: 'زائر',
        context: `
        ${baseContext}
        أنت مساعد لزوار الموقع العام.
        ساعدهم في معرفة طريقة التسجيل، تقديم الأعذار، أو معلومات عن المدرسة.
        `
    };
};

export const analyzeSentiment = async (text: string): Promise<'positive' | 'negative' | 'neutral'> => {
    try {
        // Need to wait for config in case it's fetched from DB
        const config = await getAIConfig();
        if(!config.apiKey) return 'neutral';

        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze the sentiment of this text (Student Report). Return ONLY one word: 'positive', 'negative', or 'neutral'. Text: "${text}"`
        });
        
        const res = response.text || "";
        const clean = res.trim().toLowerCase();
        if (clean.includes('positive')) return 'positive';
        if (clean.includes('negative')) return 'negative';
        return 'neutral';
    } catch (e) { return 'neutral'; }
};

// ... (Rest of storage.ts remains unchanged, providing data access functions)
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

export const testSupabaseConnection = async (): Promise<{ success: boolean; message: string }> => { try { const { data, error } = await supabase.from('students').select('count', { count: 'exact', head: true }); if (error) throw error; return { success: true, message: `Connected` }; } catch (error: any) { return { success: false, message: `Failed: ${error.message}` }; } };

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const uploadFile = async (file: File): Promise<string | null> => {
  const safeName = `${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
  
  try {
    // Try Supabase Storage first
    const { data, error } = await supabase.storage.from('excuses').upload(safeName, file);
    
    if (error) {
        throw new Error(error.message);
    }
    
    const { data: publicUrlData } = supabase.storage.from('excuses').getPublicUrl(safeName);
    return publicUrlData.publicUrl;

  } catch (err: any) {
    console.warn('Storage upload failed, attempting fallback to Base64:', err.message);
    try {
        return await fileToBase64(file);
    } catch (e) {
        console.error('Base64 conversion failed', e);
        return null;
    }
  }
};

export const getStudents = async (force = false) => { const { data, error } = await supabase.from('students').select('*'); if (error) { console.error(error); return []; } return data.map(mapStudentFromDB); };
export const getStudentsSync = () => null;
export const getStudentByCivilId = async (id: string) => { const { data, error } = await supabase.from('students').select('*').eq('student_id', id).single(); if (error) return null; return mapStudentFromDB(data); };

export const getStudentsByPhone = async (phone: string): Promise<Student[]> => {
    let cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
    let variations = [cleanPhone];
    if (cleanPhone.startsWith('966')) {
        variations.push('0' + cleanPhone.substring(3));
    } else if (cleanPhone.startsWith('05')) {
        variations.push('966' + cleanPhone.substring(1));
    }

    const { data, error } = await supabase
        .from('students')
        .select('*')
        .in('phone', variations);

    if (error || !data) return [];
    return data.map(mapStudentFromDB);
};

export const addStudent = async (student: Student) => { const { data, error } = await supabase.from('students').insert(mapStudentToDB(student)).select().single(); if (error) throw new Error(error.message); return mapStudentFromDB(data); };
export const updateStudent = async (student: Student) => { const { error } = await supabase.from('students').update(mapStudentToDB(student)).eq('student_id', student.studentId); if (error) throw new Error(error.message); };
export const deleteStudent = async (id: string) => { const { error } = await supabase.from('students').delete().eq('id', id); if (error) throw new Error(error.message); };
export const syncStudentsBatch = async (toAdd: Student[], toUpdate: Student[], toDeleteIds: string[]) => {
    if (toDeleteIds.length) await supabase.from('students').delete().in('id', toDeleteIds);
    const upsertData = [...toAdd, ...toUpdate].map(mapStudentToDB);
    if (upsertData.length) {
        const { error } = await supabase.from('students').upsert(upsertData, { onConflict: 'student_id' });
        if (error) throw new Error(error.message);
    }
};
export const getRequests = async (force = false) => { const { data, error } = await supabase.from('requests').select('*').order('submission_date', { ascending: false }); if (error) return []; return data.map(mapRequestFromDB); };
export const getRequestsByStudentId = async (studentId: string) => { const { data, error } = await supabase.from('requests').select('*').eq('student_id', studentId).order('submission_date', { ascending: false }); if (error) return []; return data.map(mapRequestFromDB); };
export const getPendingRequestsCountForStaff = async (assignments: ClassAssignment[]) => {
    const { data } = await supabase.from('requests').select('grade, class_name').eq('status', 'PENDING');
    if (!data) return 0;
    return data.filter(r => assignments.some(a => a.grade === r.grade && a.className === r.class_name)).length;
};
export const addRequest = async (request: ExcuseRequest) => { 
    const { error } = await supabase.from('requests').insert(mapRequestToDB(request)); 
    if (error) throw new Error(error.message); 
    await createNotification(request.studentId, 'info', 'تم استلام طلبك', 'تم استلام عذر الغياب وهو قيد المراجعة.');
};
export const updateRequestStatus = async (id: string, status: RequestStatus) => { 
    const { error } = await supabase.from('requests').update({ status }).eq('id', id); 
    if (error) throw new Error(error.message); 
    const { data: req } = await supabase.from('requests').select('student_id').eq('id', id).single();
    if (req) {
        const msg = status === 'APPROVED' ? 'تم قبول العذر المقدم.' : 'تم رفض العذر المقدم.';
        await createNotification(req.student_id, status === 'APPROVED' ? 'success' : 'alert', 'تحديث حالة الطلب', msg);
    }
};
export const clearRequests = async () => { await supabase.from('requests').delete().neq('id', '0'); };
export const clearStudents = async () => { await supabase.from('students').delete().neq('id', '0'); };
export const getStaffUsers = async (force = false) => { const { data, error } = await supabase.from('staff').select('*'); if (error) return []; return data.map(mapStaffFromDB); };
export const getStaffUsersSync = () => null; 
export const addStaffUser = async (user: StaffUser) => { const { error } = await supabase.from('staff').insert(mapStaffToDB(user)); if (error) throw new Error(error.message); };
export const updateStaffUser = async (user: StaffUser) => { const { error } = await supabase.from('staff').update(mapStaffToDB(user)).eq('id', user.id); if (error) throw new Error(error.message); };
export const deleteStaffUser = async (id: string) => { const { error } = await supabase.from('staff').delete().eq('id', id); if (error) throw new Error(error.message); };
export const authenticateStaff = async (passcode: string): Promise<StaffUser | undefined> => { const { data, error } = await supabase.from('staff').select('*').eq('passcode', passcode).single(); if (error || !data) return undefined; return mapStaffFromDB(data); };
export const getAvailableClassesForGrade = async (grade: string) => { const { data } = await supabase.from('students').select('class_name').eq('grade', grade); if (!data) return []; return Array.from(new Set(data.map((s: any) => s.class_name))).sort(); };

export const saveAttendanceRecord = async (record: AttendanceRecord) => { 
    const { data: existing } = await supabase.from('attendance').select('id').eq('date', record.date).eq('grade', record.grade).eq('class_name', record.className).single();
    if (existing) {
        const { error } = await supabase.from('attendance').update(mapAttendanceToDB(record)).eq('id', existing.id);
        if (error) throw new Error(error.message);
    } else {
        const { error } = await supabase.from('attendance').insert(mapAttendanceToDB(record));
        if (error) throw new Error(error.message);
    }

    const notificationBatch: any[] = [];
    
    record.records.forEach(stu => {
        if (!stu.studentId) return; 

        if (stu.status === AttendanceStatus.ABSENT) {
            notificationBatch.push({
                target_user_id: stu.studentId, 
                type: 'alert',
                title: 'تنبيه غياب',
                message: `نحيطكم علماً بأن الطالب ${stu.studentName} تغيب عن المدرسة بتاريخ ${record.date}. يرجى تقديم عذر عبر البوابة.`
            });
        } else if (stu.status === AttendanceStatus.LATE) {
            notificationBatch.push({
                target_user_id: stu.studentId,
                type: 'info',
                title: 'تنبيه تأخر',
                message: `تم رصد تأخر الطالب ${stu.studentName} عن الطابور الصباحي بتاريخ ${record.date}.`
            });
        }
    });

    if (notificationBatch.length > 0) {
        const { error } = await supabase.from('notifications').insert(notificationBatch);
        if (error) console.error("Failed to send attendance notifications:", error);
    }
};

export const getAttendanceRecordForClass = async (date: string, grade: string, className: string) => { const { data, error } = await supabase.from('attendance').select('*').eq('date', date).eq('grade', grade).eq('class_name', className).single(); if (error) return null; return mapAttendanceFromDB(data); };
export const getAttendanceRecords = async () => { const { data, error } = await supabase.from('attendance').select('*'); if (error) return []; return data.map(mapAttendanceFromDB); };
export const getStudentAttendanceHistory = async (studentId: string, grade: string, className: string) => {
    const { data: records } = await supabase.from('attendance').select('*').eq('grade', grade).eq('class_name', className);
    if (!records) return [];
    const history: { date: string, status: AttendanceStatus }[] = [];
    records.forEach((rec: any) => {
        const studentRecord = rec.records.find((r: any) => r.studentId === studentId);
        if (studentRecord) {
            history.push({ date: rec.date, status: studentRecord.status });
        }
    });
    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
export const getDailyAttendanceReport = async (date: string) => {
    const { data: records } = await supabase.from('attendance').select('*').eq('date', date);
    const details: any[] = [];
    let totalPresent = 0, totalAbsent = 0, totalLate = 0;
    if (records) {
        records.forEach((rec: any) => {
            rec.records.forEach((stu: any) => {
                if (stu.status === 'ABSENT') totalAbsent++;
                else if (stu.status === 'LATE') totalLate++;
                else totalPresent++;
                if (stu.status !== 'PRESENT') {
                    details.push({
                        studentId: stu.studentId,
                        studentName: stu.studentName,
                        grade: rec.grade,
                        className: rec.class_name,
                        status: stu.status
                    });
                }
            });
        });
    }
    return { totalPresent, totalAbsent, totalLate, details };
};
export const clearAttendance = async () => { await supabase.from('attendance').delete().neq('id', '0'); };
export const getConsecutiveAbsences = async () => {
    const { data: records } = await supabase.from('attendance').select('*').order('date', { ascending: false });
    if (!records) return [];
    const studentHistory: Record<string, {name: string, statuses: string[], dates: string[]}> = {};
    records.forEach((classRecord: any) => {
        classRecord.records.forEach((stu: any) => {
            if (!studentHistory[stu.studentId]) {
                studentHistory[stu.studentId] = { name: stu.studentName, statuses: [], dates: [] };
            }
            studentHistory[stu.studentId].statuses.push(stu.status);
            studentHistory[stu.studentId].dates.push(classRecord.date);
        });
    });
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: actions } = await supabase
        .from('risk_actions')
        .select('student_id')
        .gte('resolved_at', sevenDaysAgo.toISOString());
    const resolvedStudentIds = new Set(actions?.map((a: any) => a.student_id) || []);
    const alerts: any[] = [];
    Object.entries(studentHistory).forEach(([id, data]) => {
        let consecutive = 0;
        for (const status of data.statuses) {
            if (status === 'ABSENT') consecutive++;
            else break;
        }
        if (consecutive >= 3 && !resolvedStudentIds.has(id)) {
            alerts.push({
                studentId: id,
                studentName: data.name,
                days: consecutive,
                lastDate: data.dates[0]
            });
        }
    });
    return alerts;
};
export const resolveAbsenceAlert = async (studentId: string, action: string, notes: string = '') => { 
    const { error } = await supabase.from('risk_actions').insert({
        student_id: studentId,
        action_type: action,
        notes: notes,
        resolved_at: new Date().toISOString()
    });
    if (error) {
        console.error("Error inserting into risk_actions:", error);
        throw new Error(error.message);
    }
};
export const getRiskHistory = async () => {
    const { data, error } = await supabase.from('risk_actions').select('*').order('resolved_at', { ascending: false });
    if (error) return [];
    
    const students = await getStudents();
    return data.map((item: any) => {
        const student = students.find(s => s.studentId === item.student_id);
        return {
            ...item,
            studentName: student ? student.name : 'طالب غير موجود',
            grade: student ? student.grade : '',
            className: student ? student.className : ''
        };
    });
};

export const getBehaviorRecords = async (studentId?: string) => {
    let query = supabase.from('behaviors').select('*'); 
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapBehaviorFromDB);
};
export const addBehaviorRecord = async (record: BehaviorRecord) => { 
    const { error } = await supabase.from('behaviors').insert(mapBehaviorToDB(record)); 
    if (error) throw new Error(error.message); 
    await createNotification(record.studentId, 'alert', 'مخالفة سلوكية', `تم تسجيل مخالفة: ${record.violationName} - ${record.actionTaken}`);
};
export const updateBehaviorRecord = async (record: BehaviorRecord) => { const { error } = await supabase.from('behaviors').update(mapBehaviorToDB(record)).eq('id', record.id); if (error) throw new Error(error.message); };
export const deleteBehaviorRecord = async (id: string) => { const { error } = await supabase.from('behaviors').delete().eq('id', id); if (error) throw new Error(error.message); };
export const acknowledgeBehavior = async (id: string, feedback: string) => { await supabase.from('behaviors').update({ parent_viewed: true, parent_feedback: feedback, parent_viewed_at: new Date().toISOString() }).eq('id', id); };
export const clearBehaviorRecords = async () => { await supabase.from('behaviors').delete().neq('id', '0'); };
export const getStudentObservations = async (studentId?: string, type?: string) => {
    let query = supabase.from('observations').select('*');
    if (studentId) query = query.eq('student_id', studentId);
    if (type) query = query.eq('type', type);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapObservationFromDB);
};
export const addStudentObservation = async (obs: StudentObservation) => { 
    const { error } = await supabase.from('observations').insert(mapObservationToDB(obs)); 
    if (error) throw new Error(error.message); 
    if (obs.type === 'positive') await createNotification(obs.studentId, 'success', 'تعزيز إيجابي', `رائع! ${obs.content}`);
    else if (obs.type === 'behavioral') await createNotification(obs.studentId, 'alert', 'ملاحظة سلوكية', obs.content);
    else await createNotification(obs.studentId, 'info', 'ملاحظة مدرسية', obs.content);
};
export const updateStudentObservation = async (id: string, content: string, type: any) => { await supabase.from('observations').update({ content, type }).eq('id', id); };
export const deleteStudentObservation = async (id: string) => { await supabase.from('observations').delete().eq('id', id); };
export const acknowledgeObservation = async (id: string, feedback: string) => { await supabase.from('observations').update({ parent_viewed: true, parent_feedback: feedback, parent_viewed_at: new Date().toISOString() }).eq('id', id); };
export const getAdminInsights = async (targetRole?: 'deputy' | 'counselor' | 'teachers') => {
    let query = supabase.from('admin_insights').select('*');
    if (targetRole) query = query.eq('target_role', targetRole);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapInsightFromDB);
};
export const sendAdminInsight = async (targetRole: 'deputy' | 'counselor' | 'teachers', content: string) => {
    const { error } = await supabase.from('admin_insights').insert({ target_role: targetRole, content });
    if (error) throw new Error(error.message);
};
export const clearAdminInsights = async () => { await supabase.from('admin_insights').delete().neq('id', '0'); };
export const addReferral = async (referral: Referral) => { const { error } = await supabase.from('referrals').insert(mapReferralToDB(referral)); if (error) throw new Error(error.message); };
export const getReferrals = async (studentId?: string) => {
    let query = supabase.from('referrals').select('*');
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapReferralFromDB);
};
export const updateReferralStatus = async (id: string, status: string, outcome?: string) => {
    const updateData: any = { status };
    if (outcome) updateData.outcome = outcome;
    const { error } = await supabase.from('referrals').update(updateData).eq('id', id);
    if (error) throw new Error(error.message);
};
export const clearReferrals = async () => { await supabase.from('referrals').delete().neq('id', '0'); };
export const addGuidanceSession = async (session: GuidanceSession) => { const { error } = await supabase.from('guidance_sessions').insert(mapSessionToDB(session)); if (error) throw new Error(error.message); };
export const updateGuidanceSession = async (session: GuidanceSession) => { const { error } = await supabase.from('guidance_sessions').update(mapSessionToDB(session)).eq('id', session.id); if (error) throw new Error(error.message); };
export const deleteGuidanceSession = async (id: string) => { const { error } = await supabase.from('guidance_sessions').delete().eq('id', id); if (error) throw new Error(error.message); };
export const getGuidanceSessions = async () => { const { data, error } = await supabase.from('guidance_sessions').select('*').order('date', { ascending: false }); if (error) return []; return data.map(mapSessionFromDB); };

export const saveBotContext = async (content: string) => {
    await supabase.from('admin_insights').delete().eq('target_role', 'bot_context');
    const { error } = await supabase.from('admin_insights').insert({
        target_role: 'bot_context',
        content: content,
        is_read: false
    });
    if (error) throw new Error(error.message);
};

export const getBotContext = async () => {
    const { data, error } = await supabase
        .from('admin_insights')
        .select('content')
        .eq('target_role', 'bot_context')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    if (error || !data) return "";
    return data.content;
};

// ... (Exit Permissions, Appointments, News, Parent Link, Student Points - keep existing code) ...
const mapExitFromDB = (e: any): ExitPermission => ({ id: e.id, studentId: e.student_id, studentName: e.student_name, grade: e.grade, className: e.class_name, parentName: e.parent_name, parentPhone: e.parent_phone, reason: e.reason, createdBy: e.created_by, createdByName: e.created_by_name, status: e.status, createdAt: e.created_at, completedAt: e.completed_at });
export const addExitPermission = async (perm: Omit<ExitPermission, 'id' | 'status' | 'createdAt' | 'completedAt'>) => { const { error } = await supabase.from('exit_permissions').insert({ student_id: perm.studentId, student_name: perm.studentName, grade: perm.grade, class_name: perm.className, parent_name: perm.parentName, parent_phone: perm.parentPhone, reason: perm.reason, created_by: perm.createdBy, created_by_name: perm.createdByName, status: 'pending_pickup' }); if (error) throw new Error(error.message); };
export const getExitPermissions = async (date?: string, status?: string) => { let query = supabase.from('exit_permissions').select('*'); if (date) query = query.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`); if (status) query = query.eq('status', status); const { data, error } = await query.order('created_at', { ascending: false }); if (error) return []; return data.map(mapExitFromDB); };
export const getExitPermissionById = async (id: string): Promise<ExitPermission | null> => { const { data, error } = await supabase.from('exit_permissions').select('*').eq('id', id).single(); if (error) return null; return mapExitFromDB(data); };
export const getMyExitPermissions = async (studentIds: string[]) => { if (studentIds.length === 0) return []; const { data, error } = await supabase.from('exit_permissions').select('*').in('student_id', studentIds).order('created_at', { ascending: false }); if (error) return []; return data.map(mapExitFromDB); };
export const completeExitPermission = async (id: string) => { 
    const { error } = await supabase.from('exit_permissions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id); 
    if (error) throw new Error(error.message); 
    
    const { data: perm } = await supabase.from('exit_permissions').select('student_id, student_name').eq('id', id).single();
    if (perm) {
        await createNotification(perm.student_id, 'info', 'خروج طالب', `تم تسجيل خروج الطالب ${perm.student_name} من البوابة الآن.`);
    }
};

export const getAvailableSlots = async (date?: string) => { let query = supabase.from('appointment_slots').select('*'); if (date) query = query.eq('date', date); else { const today = new Date().toISOString().split('T')[0]; query = query.gte('date', today); } const { data, error } = await query.order('date', { ascending: true }).order('start_time', { ascending: true }); if (error) return []; return data.map((s: any) => ({ id: s.id, date: s.date, startTime: s.start_time, endTime: s.end_time, maxCapacity: s.max_capacity, currentBookings: s.current_bookings })); };
export const generateDefaultAppointmentSlots = async (date: string) => { 
    const slots = []; 
    const startHour = 8; 
    const startMinute = 0; 
    const endHour = 11; 
    let current = new Date(`${date}T${startHour.toString().padStart(2,'0')}:${startMinute.toString().padStart(2,'0')}:00`); 
    const end = new Date(`${date}T${endHour.toString().padStart(2,'0')}:00:00`); 
    
    while (current < end) { 
        const startTime = current.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'}); 
        current.setMinutes(current.getMinutes() + 30); 
        const endTime = current.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'}); 
        slots.push({ date: date, start_time: startTime, end_time: endTime, max_capacity: 3, current_bookings: 0 }); 
    } 
    const { error } = await supabase.from('appointment_slots').insert(slots); 
    if (error) throw new Error(error.message); 
};
export const addAppointmentSlot = async (slot: Omit<AppointmentSlot, 'id' | 'currentBookings'>) => { const { error } = await supabase.from('appointment_slots').insert({ date: slot.date, start_time: slot.startTime, end_time: slot.endTime, max_capacity: slot.maxCapacity }); if (error) throw new Error(error.message); };
export const updateAppointmentSlot = async (slot: AppointmentSlot) => { const { error } = await supabase.from('appointment_slots').update({ start_time: slot.startTime, end_time: slot.endTime, max_capacity: slot.maxCapacity }).eq('id', slot.id); if (error) throw new Error(error.message); };
export const deleteAppointmentSlot = async (id: string) => { const { error } = await supabase.from('appointment_slots').delete().eq('id', id); if (error) throw new Error(error.message); };
export const bookAppointment = async (appt: Omit<Appointment, 'id' | 'status' | 'createdAt'>) => { const { data: slot, error: slotError } = await supabase.from('appointment_slots').select('*').eq('id', appt.slotId).single(); if (slotError || !slot) throw new Error("الموعد غير موجود"); if (slot.current_bookings >= slot.max_capacity) throw new Error("عفواً، اكتمل العدد لهذا الموعد"); const { data: newAppt, error: bookError } = await supabase.from('appointments').insert({ slot_id: appt.slotId, student_id: appt.studentId, student_name: appt.studentName, parent_name: appt.parentName, parent_civil_id: appt.parentCivilId, visit_reason: appt.visitReason }).select().single(); if (bookError) throw new Error(bookError.message); await supabase.from('appointment_slots').update({ current_bookings: slot.current_bookings + 1 }).eq('id', appt.slotId); return { id: newAppt.id, slotId: newAppt.slot_id, studentId: newAppt.student_id, studentName: newAppt.student_name, parentName: newAppt.parent_name, parentCivilId: newAppt.parent_civil_id, visitReason: newAppt.visit_reason, status: newAppt.status, createdAt: newAppt.created_at, slot: { id: slot.id, date: slot.date, startTime: slot.start_time, endTime: slot.end_time, maxCapacity: slot.max_capacity, currentBookings: slot.current_bookings + 1 } }; };
export const getMyAppointments = async (parentCivilId: string) => { const { data, error } = await supabase.from('appointments').select(`*, slot:appointment_slots(*)`).eq('parent_civil_id', parentCivilId).order('created_at', { ascending: false }); if (error) return []; return data.map((a: any) => ({ id: a.id, slotId: a.slot_id, studentId: a.student_id, studentName: a.student_name, parentName: a.parent_name, parentCivilId: a.parent_civil_id, visitReason: a.visit_reason, status: a.status, arrivedAt: a.arrived_at, createdAt: a.created_at, slot: a.slot ? { id: a.slot.id, date: a.slot.date, startTime: a.slot.start_time, endTime: a.slot.end_time, maxCapacity: a.slot.max_capacity, currentBookings: a.slot.current_bookings } : undefined })); };
export const getDailyAppointments = async (date?: string) => { 
    let query = supabase.from('appointments').select(`*, slot:appointment_slots(*)`); 
    const { data, error } = await query.order('created_at', { ascending: false }); 
    if (error) return []; 
    
    const mapped = data.map((a: any) => ({ 
        id: a.id, 
        slotId: a.slot_id, 
        studentId: a.student_id, 
        studentName: a.student_name, 
        parentName: a.parent_name, 
        parentCivilId: a.parent_civil_id, 
        visitReason: a.visit_reason, 
        status: a.status, 
        arrivedAt: a.arrived_at, 
        createdAt: a.created_at, 
        slot: a.slot ? { 
            id: a.slot.id, 
            date: a.slot.date, 
            startTime: a.slot.start_time, 
            endTime: a.slot.end_time 
        } : undefined 
    })); 
    
    if (date) { 
        return mapped.filter((a: Appointment) => a.slot?.date === date); 
    } 
    return mapped; 
};
export const checkInVisitor = async (appointmentId: string) => { 
    const { error } = await supabase.from('appointments').update({ 
        status: 'completed', 
        arrived_at: new Date().toISOString() 
    }).eq('id', appointmentId); 
    
    if (error) throw new Error(error.message); 
    
    const { data: appt } = await supabase.from('appointments').select('student_id, parent_name').eq('id', appointmentId).single();
    if(appt) {
        await createNotification(appt.student_id, 'success', 'تسجيل دخول', `تم تسجيل دخول ولي الأمر ${appt.parent_name} للمدرسة.`);
    }
};

export const getSchoolNews = async () => { const { data, error } = await supabase.from('news').select('*').order('created_at', { ascending: false }); if (error) return []; return data.map((n: any) => ({ id: n.id, title: n.title, content: n.content, author: n.author, isUrgent: n.is_urgent, createdAt: n.created_at })); };
export const addSchoolNews = async (news: Omit<SchoolNews, 'id' | 'createdAt'>) => { 
    const { error } = await supabase.from('news').insert({ title: news.title, content: news.content, author: news.author, is_urgent: news.isUrgent }); 
    if (error) throw new Error(error.message); 
    
    if (news.isUrgent) {
        await createNotification('ALL', 'alert', 'خبر عاجل', `${news.title}: ${news.content}`);
    }
};
export const updateSchoolNews = async (news: SchoolNews) => { const { error } = await supabase.from('news').update({ title: news.title, content: news.content, is_urgent: news.isUrgent }).eq('id', news.id); if (error) throw new Error(error.message); };
export const deleteSchoolNews = async (id: string) => { const { error } = await supabase.from('news').delete().eq('id', id); if (error) throw new Error(error.message); };

export const linkParentToStudent = async (parentCivilId: string, studentId: string) => { const { data } = await supabase.from('parent_links').select('*').eq('parent_civil_id', parentCivilId).eq('student_id', studentId); if (data && data.length > 0) return; const { error } = await supabase.from('parent_links').insert({ parent_civil_id: parentCivilId, student_id: studentId }); if (error) throw new Error(error.message); };
export const getParentChildren = async (parentCivilId: string): Promise<Student[]> => { const { data: links, error } = await supabase.from('parent_links').select('student_id').eq('parent_civil_id', parentCivilId); if (error) return []; if (!links || links.length === 0) return []; const studentIds = links.map((l: any) => l.student_id); const { data: students, error: err2 } = await supabase.from('students').select('*').in('student_id', studentIds); if (err2) return []; return students.map(mapStudentFromDB); };
export const addStudentPoints = async (studentId: string, points: number, reason: string, type: 'behavior' | 'attendance' | 'academic') => { const { error } = await supabase.from('student_points').insert({ student_id: studentId, points, reason, type }); if (error) throw new Error(error.message); await createNotification(studentId, 'info', 'نقاط جديدة', `تم إضافة ${points} نقطة لرصيدك: ${reason}`); };
export const getStudentPoints = async (studentId: string): Promise<{total: number, history: StudentPoint[]}> => { const { data, error } = await supabase.from('student_points').select('*').eq('student_id', studentId).order('created_at', { ascending: false }); if (error) return { total: 0, history: [] }; const total = data.reduce((sum: number, item: any) => sum + item.points, 0); const history = data.map((p: any) => ({ id: p.id, studentId: p.student_id, points: p.points, reason: p.reason, type: p.type, createdAt: p.created_at })); return { total, history }; };
export const getTopStudents = async (limit = 5) => { const { data, error } = await supabase.from('student_points').select('student_id, points'); if (error) return []; const totals: Record<string, number> = {}; data.forEach((row: any) => { totals[row.student_id] = (totals[row.student_id] || 0) + row.points; }); const topIds = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit); const result = []; for (const [sid, score] of topIds) { const student = await getStudentByCivilId(sid); if (student) result.push({ ...student, points: score }); } return result; };
export const createNotification = async (targetId: string, type: 'alert'|'info'|'success', title: string, message: string) => { 
    if(!targetId) return;
    await supabase.from('notifications').insert({ target_user_id: targetId, type, title, message }); 
};
export const sendBatchNotifications = async (targetUserIds: string[], type: 'alert'|'info'|'success', title: string, message: string) => {
    if (targetUserIds.length === 0) return;
    const notifications = targetUserIds.map(id => ({
        target_user_id: id,
        type,
        title,
        message
    }));
    await supabase.from('notifications').insert(notifications);
};
export const getNotifications = async (targetId: string) => { const { data, error } = await supabase.from('notifications').select('*').eq('target_user_id', targetId).order('created_at', { ascending: false }); if (error) return []; return data.map((n: any) => ({ id: n.id, targetUserId: n.target_user_id, title: n.title, message: n.message, isRead: n.is_read, type: n.type, createdAt: n.created_at })); };
export const markNotificationRead = async (id: string) => { await supabase.from('notifications').update({ is_read: true }).eq('id', id); };

export const checkParentRegistration = async (parentCivilId: string): Promise<boolean> => {
    const { data, error } = await supabase
        .from('parent_links')
        .select('id')
        .eq('parent_civil_id', parentCivilId)
        .limit(1);
    
    if (error) {
        console.error("Error checking parent registration:", error);
        return false;
    }
    
    return data && data.length > 0;
};

export const generateTeacherAbsenceSummary = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: attendanceData } = await supabase.from('attendance').select('*').eq('date', today);
    const users = await getStaffUsers();
    
    if (!attendanceData || attendanceData.length === 0) return { success: false, message: 'لا يوجد بيانات حضور لهذا اليوم بعد.' };

    const notificationsToSend: any[] = [];

    for (const teacher of users) {
        let absentCount = 0;
        const myAssignments = teacher.assignments || [];
        
        myAssignments.forEach(assignment => {
            const classRecord = attendanceData.find((r: any) => r.grade === assignment.grade && r.class_name === assignment.className);
            if (classRecord && classRecord.records) {
                absentCount += classRecord.records.filter((stu: any) => stu.status === 'ABSENT').length;
            }
        });

        if (absentCount > 0) {
            notificationsToSend.push({
                target_user_id: teacher.id,
                type: 'info',
                title: 'ملخص الغياب اليومي',
                message: `تم رصد غياب ${absentCount} طالب في الفصول المسندة إليك اليوم (${today}).`
            });
        }
    }

    if (notificationsToSend.length > 0) {
        await supabase.from('notifications').insert(notificationsToSend);
        return { success: true, message: `تم إرسال ${notificationsToSend.length} إشعار للمعلمين.` };
    }
    return { success: true, message: 'لم يتم العثور على حالات غياب تستدعي التنبيه.' };
};

export const sendPendingReferralReminders = async () => {
    const { data: pendingReferrals } = await supabase.from('referrals').select('*').eq('status', 'pending');
    if (!pendingReferrals || pendingReferrals.length === 0) return { success: true, message: 'لا توجد إحالات معلقة.' };

    const users = await getStaffUsers();
    const targetStaff = users.filter(u => u.permissions?.includes('students') || u.permissions?.includes('deputy'));
    
    const notificationsToSend = targetStaff.map(staff => ({
        target_user_id: staff.id,
        type: 'alert',
        title: 'تذكير: إحالات معلقة',
        message: `يوجد ${pendingReferrals.length} إحالة جديدة بانتظار المعالجة. يرجى مراجعة صندوق الوارد.`
    }));

    if (notificationsToSend.length > 0) {
        await supabase.from('notifications').insert(notificationsToSend);
        return { success: true, message: `تم تنبيه ${notificationsToSend.length} من المختصين.` };
    }
    return { success: false, message: 'لم يتم العثور على موجهين/وكلاء لإرسال التنبيه.' };
};
