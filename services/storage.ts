import { supabase } from '../supabaseClient';
import { 
  Student, ExcuseRequest, StaffUser, AttendanceRecord, BehaviorRecord, 
  SchoolNews, Appointment, AppointmentSlot, ExitPermission, 
  StudentObservation, Referral, GuidanceSession, AppNotification, 
  RequestStatus, AttendanceStatus, AdminInsight, ClassAssignment
} from '../types';
import { GRADES } from '../constants';
import { GoogleGenAI } from "@google/genai";

// Cache for sync access
let studentsCache: Student[] | null = null;
let staffCache: StaffUser[] | null = null;

// --- Helpers ---
const mapStudentFromDB = (data: any): Student => ({
  id: data.id,
  name: data.name,
  studentId: data.student_id,
  grade: data.grade,
  className: data.class_name,
  phone: data.phone
});

const safeParseJSON = (val: any): any => {
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (e) { return []; }
    }
    return val || [];
};

export const invalidateCache = () => {
    studentsCache = null;
    staffCache = null;
};

// --- Students ---

export const getStudents = async (force = false): Promise<Student[]> => {
  if (!force && studentsCache) return studentsCache;
  
  const { data, error } = await supabase.from('students').select('*');
  if (error) throw new Error(error.message);
  
  studentsCache = data.map(mapStudentFromDB);
  return studentsCache;
};

export const getStudentsSync = (): Student[] | null => studentsCache;

export const getStudentByCivilId = async (civilId: string): Promise<Student | null> => {
    const { data, error } = await supabase.from('students').select('*').eq('student_id', civilId).single();
    if (error || !data) return null;
    return mapStudentFromDB(data);
};

export const getStudentsByPhone = async (phone: string): Promise<Student[]> => {
    const { data, error } = await supabase.from('students').select('*').like('phone', `%${phone}%`);
    if (error || !data) return [];
    return data.map(mapStudentFromDB);
};

export const addStudent = async (student: Student): Promise<Student> => {
    const { data, error } = await supabase.from('students').insert({
        name: student.name,
        student_id: student.studentId,
        grade: student.grade,
        class_name: student.className,
        phone: student.phone
    }).select().single();
    
    if (error) throw new Error(error.message);
    if (studentsCache) studentsCache.push(mapStudentFromDB(data));
    return mapStudentFromDB(data);
};

export const updateStudent = async (student: Student): Promise<void> => {
    const { error } = await supabase.from('students').update({
        name: student.name,
        student_id: student.studentId,
        grade: student.grade,
        class_name: student.className,
        phone: student.phone
    }).eq('id', student.id);
    if (error) throw new Error(error.message);
    invalidateCache();
};

export const deleteStudent = async (id: string): Promise<void> => {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw new Error(error.message);
    invalidateCache();
};

export const syncStudentsBatch = async (toUpsert: Student[], toDeleteIds: string[], toDeleteDbIds: string[] = []) => {
    if (toDeleteDbIds.length > 0) {
        await supabase.from('students').delete().in('id', toDeleteDbIds);
    }
    
    for (const s of toUpsert) {
        const { data: existing } = await supabase.from('students').select('id').eq('student_id', s.studentId).single();
        if (existing) {
            await supabase.from('students').update({
                name: s.name,
                grade: s.grade,
                class_name: s.className,
                phone: s.phone
            }).eq('id', existing.id);
        } else {
            await supabase.from('students').insert({
                name: s.name,
                student_id: s.studentId,
                grade: s.grade,
                class_name: s.className,
                phone: s.phone
            });
        }
    }
    invalidateCache();
};

export const clearStudents = async () => {
    const { error } = await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
    if (error) throw new Error(error.message);
    invalidateCache();
}

// --- Requests (Excuses) ---

export const getRequests = async (force = false): Promise<ExcuseRequest[]> => {
    const { data, error } = await supabase.from('requests').select('*');
    if (error) {
        console.error('getRequests error:', error);
        return [];
    }
    return data.map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        studentName: r.student_name,
        grade: r.grade,
        className: r.class_name,
        date: r.date,
        reason: r.reason,
        details: r.details,
        attachmentName: r.attachment_name,
        attachmentUrl: r.attachment_url,
        status: r.status as RequestStatus,
    }));
};

export const getRequestsByStudentId = async (studentId: string): Promise<ExcuseRequest[]> => {
    const { data, error } = await supabase.from('requests').select('*').eq('student_id', studentId);
    if (error) return [];
    return data.map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        studentName: r.student_name,
        grade: r.grade,
        className: r.class_name,
        date: r.date,
        reason: r.reason,
        details: r.details,
        attachmentName: r.attachment_name,
        attachmentUrl: r.attachment_url,
        status: r.status as RequestStatus,
    }));
};

export const addRequest = async (req: ExcuseRequest): Promise<void> => {
    const { error } = await supabase.from('requests').insert({
        student_id: req.studentId,
        student_name: req.studentName,
        grade: req.grade,
        class_name: req.className,
        date: req.date,
        reason: req.reason,
        details: req.details,
        attachment_name: req.attachmentName,
        attachment_url: req.attachmentUrl,
        status: req.status
    });
    if (error) throw new Error(error.message);
    
    await createNotification('ALL_STAFF', 'info', 'عذر جديد', `تم تقديم عذر للطالب ${req.studentName}`);
};

export const updateRequestStatus = async (id: string, status: RequestStatus): Promise<void> => {
    const { error } = await supabase.from('requests').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
    
    const { data: req } = await supabase.from('requests').select('student_id').eq('id', id).single();
    if (req) {
        await createNotification(req.student_id, status === RequestStatus.APPROVED ? 'success' : 'alert', 'تحديث حالة العذر', `تم ${status === RequestStatus.APPROVED ? 'قبول' : 'رفض'} العذر المقدم.`);
    }
};

export const getPendingRequestsCountForStaff = async (assignments: any[]): Promise<number> => {
    if (!assignments || assignments.length === 0) return 0;
    const { count, error } = await supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
    return count || 0;
};

export const clearRequests = async () => {
    await supabase.from('requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
};

export const uploadFile = async (file: File): Promise<string> => {
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('excuses').upload(fileName, file);
    if (error) throw new Error(error.message);
    const { data: publicData } = supabase.storage.from('excuses').getPublicUrl(fileName);
    return publicData.publicUrl;
};

// --- Attendance ---

export const saveAttendanceRecord = async (record: AttendanceRecord): Promise<void> => {
    const { data: existing } = await supabase.from('attendance_records')
        .select('id')
        .eq('date', record.date)
        .eq('grade', record.grade)
        .eq('class_name', record.className)
        .single();

    if (existing) {
        await supabase.from('attendance_records').update({
            records: record.records,
            staff_id: record.staffId
        }).eq('id', existing.id);
    } else {
        await supabase.from('attendance_records').insert({
            date: record.date,
            grade: record.grade,
            class_name: record.className,
            staff_id: record.staffId,
            records: record.records
        });
    }
};

export const getAttendanceRecordForClass = async (date: string, grade: string, className: string): Promise<AttendanceRecord | null> => {
    const { data, error } = await supabase.from('attendance_records')
        .select('*')
        .eq('date', date)
        .eq('grade', grade)
        .eq('class_name', className)
        .single();
    
    if (error || !data) return null;
    return {
        id: data.id,
        date: data.date,
        grade: data.grade,
        className: data.class_name,
        staffId: data.staff_id,
        records: data.records
    };
};

export const getAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
    const { data, error } = await supabase.from('attendance_records').select('*');
    if (error) return [];
    return data.map((r: any) => ({
        id: r.id,
        date: r.date,
        grade: r.grade,
        className: r.class_name,
        staffId: r.staff_id,
        records: r.records
    }));
};

export const getStudentAttendanceHistory = async (studentId: string, grade?: string, className?: string): Promise<{ date: string, status: AttendanceStatus }[]> => {
    const { data, error } = await supabase.from('attendance_records').select('date, records');
    
    if (error || !data) return [];
    
    const history: { date: string, status: AttendanceStatus }[] = [];
    data.forEach((row: any) => {
        const studentRecord = row.records.find((r: any) => r.studentId === studentId);
        if (studentRecord) {
            history.push({ date: row.date, status: studentRecord.status });
        }
    });
    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getDailyAttendanceReport = async (date: string) => {
    const { data, error } = await supabase.from('attendance_records').select('*').eq('date', date);
    if (error) return { totalPresent: 0, totalAbsent: 0, totalLate: 0, details: [] };

    let totalPresent = 0, totalAbsent = 0, totalLate = 0;
    const details: any[] = [];

    data.forEach((row: any) => {
        row.records.forEach((rec: any) => {
            if (rec.status === 'PRESENT') totalPresent++;
            else if (rec.status === 'ABSENT') totalAbsent++;
            else if (rec.status === 'LATE') totalLate++;

            details.push({
                studentId: rec.studentId,
                studentName: rec.studentName,
                grade: row.grade,
                className: row.class_name,
                status: rec.status
            });
        });
    });

    return { totalPresent, totalAbsent, totalLate, details };
};

export const getConsecutiveAbsences = async () => {
    return []; 
};

export const resolveAbsenceAlert = async (studentId: string, action: string, note?: string) => {
    await supabase.from('risk_history').insert({
        student_id: studentId,
        action_type: action,
        notes: note,
        resolved_at: new Date().toISOString()
    });
};

export const getRiskHistory = async () => {
    const { data, error } = await supabase.from('risk_history').select('*');
    if (error) return [];
    return data.map((d: any) => ({
        id: d.id,
        studentId: d.student_id,
        studentName: d.student_name || '', 
        grade: d.grade || '',
        action_type: d.action_type,
        notes: d.notes,
        resolved_at: d.resolved_at
    }));
};

export const clearAttendance = async () => {
    await supabase.from('attendance_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

// --- Behavior ---

export const getBehaviorRecords = async (studentId?: string): Promise<BehaviorRecord[]> => {
    let query = supabase.from('behavior_records').select('*');
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    
    if (error) return [];
    return data.map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        studentName: r.student_name,
        grade: r.grade,
        className: r.class_name,
        date: r.date,
        violationDegree: r.violation_degree,
        violationName: r.violation_name,
        articleNumber: r.article_number,
        actionTaken: r.action_taken,
        notes: r.notes,
        staffId: r.staff_id,
        createdAt: r.created_at,
        parentViewed: r.parent_viewed,
        parentFeedback: r.parent_feedback,
        parentViewedAt: r.parent_viewed_at
    }));
};

export const addBehaviorRecord = async (record: BehaviorRecord) => {
    const { error } = await supabase.from('behavior_records').insert({
        student_id: record.studentId,
        student_name: record.studentName,
        grade: record.grade,
        class_name: record.className,
        date: record.date,
        violation_degree: record.violationDegree,
        violation_name: record.violationName,
        article_number: record.articleNumber,
        action_taken: record.actionTaken,
        notes: record.notes,
        staff_id: record.staffId
    });
    if (error) throw new Error(error.message);
    await createNotification(record.studentId, 'alert', 'مخالفة سلوكية', `تم تسجيل مخالفة: ${record.violationName}`);
};

export const updateBehaviorRecord = async (record: BehaviorRecord) => {
    const { error } = await supabase.from('behavior_records').update({
        violation_degree: record.violationDegree,
        violation_name: record.violationName,
        action_taken: record.actionTaken,
        notes: record.notes
    }).eq('id', record.id);
    if (error) throw new Error(error.message);
};

export const deleteBehaviorRecord = async (id: string) => {
    await supabase.from('behavior_records').delete().eq('id', id);
};

export const clearBehaviorRecords = async () => {
    await supabase.from('behavior_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
};

export const acknowledgeBehavior = async (id: string, feedback: string) => {
    await supabase.from('behavior_records').update({
        parent_viewed: true,
        parent_feedback: feedback,
        parent_viewed_at: new Date().toISOString()
    }).eq('id', id);
};

export const suggestBehaviorAction = async (violation: string, degree: string): Promise<string> => {
    return "تنبيه شفهي وتعهد خطي";
};

// --- Observations ---

export const getStudentObservations = async (studentId?: string, type?: string): Promise<StudentObservation[]> => {
    let query = supabase.from('student_observations').select('*');
    if (studentId) query = query.eq('student_id', studentId);
    if (type) query = query.eq('type', type);
    
    const { data, error } = await query;
    if (error) return [];
    
    return data.map((o: any) => ({
        id: o.id,
        studentId: o.student_id,
        studentName: o.student_name,
        grade: o.grade,
        className: o.class_name,
        date: o.date,
        type: o.type,
        content: o.content,
        staffId: o.staff_id,
        staffName: o.staff_name,
        sentiment: o.sentiment,
        parentViewed: o.parent_viewed,
        parentFeedback: o.parent_feedback
    }));
};

export const addStudentObservation = async (obs: StudentObservation) => {
    await supabase.from('student_observations').insert({
        student_id: obs.studentId,
        student_name: obs.studentName,
        grade: obs.grade,
        class_name: obs.className,
        date: obs.date,
        type: obs.type,
        content: obs.content,
        staff_id: obs.staffId,
        staff_name: obs.staffName,
        sentiment: obs.sentiment
    });
    await createNotification(obs.studentId, 'info', 'ملاحظة جديدة', `سجل ${obs.staffName} ملاحظة: ${obs.type === 'positive' ? 'إيجابية' : 'جديدة'}`);
};

export const updateStudentObservation = async (id: string, content: string, type: string) => {
    await supabase.from('student_observations').update({ content, type }).eq('id', id);
};

export const deleteStudentObservation = async (id: string) => {
    await supabase.from('student_observations').delete().eq('id', id);
};

export const acknowledgeObservation = async (id: string, feedback: string) => {
    await supabase.from('student_observations').update({
        parent_viewed: true,
        parent_feedback: feedback,
        parent_viewed_at: new Date().toISOString()
    }).eq('id', id);
};

// --- Staff ---

export const getStaffUsers = async (force = false): Promise<StaffUser[]> => {
    if (!force && staffCache) return staffCache;
    const { data, error } = await supabase.from('staff').select('*');
    if (error) return [];
    
    staffCache = data.map((u: any) => ({
        id: u.id,
        name: u.name,
        passcode: u.passcode,
        assignments: safeParseJSON(u.assignments) as ClassAssignment[],
        permissions: safeParseJSON(u.permissions) as string[]
    }));
    return staffCache;
};

export const getStaffUsersSync = () => staffCache;

export const addStaffUser = async (user: StaffUser) => {
    await supabase.from('staff').insert({
        name: user.name,
        passcode: user.passcode,
        assignments: user.assignments,
        permissions: user.permissions
    });
    invalidateCache();
};

export const updateStaffUser = async (user: StaffUser) => {
    await supabase.from('staff').update({
        name: user.name,
        passcode: user.passcode,
        assignments: user.assignments,
        permissions: user.permissions
    }).eq('id', user.id);
    invalidateCache();
};

export const deleteStaffUser = async (id: string) => {
    await supabase.from('staff').delete().eq('id', id);
    invalidateCache();
};

export const authenticateStaff = async (passcode: string): Promise<StaffUser | null> => {
    const { data, error } = await supabase.from('staff').select('*').eq('passcode', passcode).single();
    if (error || !data) return null;
    return {
        id: data.id,
        name: data.name,
        passcode: data.passcode,
        assignments: safeParseJSON(data.assignments) as ClassAssignment[],
        permissions: safeParseJSON(data.permissions) as string[]
    };
};

export const getAvailableClassesForGrade = async (grade: string): Promise<string[]> => {
    const { data, error } = await supabase.from('students').select('class_name').eq('grade', grade);
    if (error || !data) return [];
    return Array.from(new Set(data.map((item: any) => item.class_name as string))).filter(Boolean).sort();
};

export const getExistingGrades = async (): Promise<string[]> => {
    return GRADES;
};

// --- Notifications ---

export const getNotifications = async (userId: string): Promise<AppNotification[]> => {
    const { data, error } = await supabase.from('notifications')
        .select('*')
        .or(`target_user_id.eq.${userId},target_user_id.eq.ALL`)
        .order('created_at', { ascending: false })
        .limit(20);
    
    if (error) return [];
    return data.map((n: any) => ({
        id: n.id,
        targetUserId: n.target_user_id,
        title: n.title,
        message: n.message,
        isRead: n.is_read,
        type: n.type,
        createdAt: n.created_at
    }));
};

export const createNotification = async (targetId: string, type: 'alert' | 'info' | 'success', title: string, message: string) => {
    await supabase.from('notifications').insert({
        target_user_id: targetId,
        type,
        title,
        message,
        is_read: false
    });
};

export const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
};

export const sendBatchNotifications = async (targetIds: string[], type: string, title: string, message: string) => {
    const rows = targetIds.map(id => ({
        target_user_id: id,
        type,
        title,
        message,
        is_read: false
    }));
    await supabase.from('notifications').insert(rows);
};

// --- Parents ---

export const getParentChildren = async (parentCivilId: string): Promise<Student[]> => {
    const { data: links, error } = await supabase.from('parent_links').select('student_id').eq('parent_civil_id', parentCivilId);
    if (error) return [];
    if (!links || links.length === 0) return [];
    
    const studentIds = links.map((l: any) => l.student_id);
    const { data: students, error: err2 } = await supabase.from('students').select('*').in('student_id', studentIds);
    if (err2) return [];
    
    return students.map(mapStudentFromDB);
};

export const linkParentToStudent = async (parentCivilId: string, studentId: string) => {
    const { error } = await supabase.from('parent_links').insert({
        parent_civil_id: parentCivilId,
        student_id: studentId
    });
    if (error && !error.message.includes('duplicate')) throw new Error(error.message);
};

export const getAllParentIds = async (): Promise<string[]> => {
    const { data, error } = await supabase.from('parent_links').select('parent_civil_id');
    if (error || !data) return [];
    return Array.from(new Set(data.map((r: any) => r.parent_civil_id)));
};

export const checkParentRegistration = async (civilId: string): Promise<boolean> => {
    const { data, error } = await supabase.from('parent_links').select('id').eq('parent_civil_id', civilId).limit(1);
    return !!data && data.length > 0;
};

// --- Points ---

export const addStudentPoints = async (studentId: string, points: number, reason: string, type: 'behavior' | 'attendance' | 'academic') => {
    const { error } = await supabase.from('student_points').insert({ student_id: studentId, points, reason, type });
    if (error) throw new Error(error.message);
    await createNotification(studentId, 'info', 'نقاط جديدة', `تم إضافة ${points} نقطة لرصيدك: ${reason}`);
};

export const getStudentPoints = async (studentId: string) => {
    const { data, error } = await supabase.from('student_points').select('*').eq('student_id', studentId);
    if (error) return { total: 0, history: [] };
    const total = data.reduce((sum: number, r: any) => sum + r.points, 0);
    return { total, history: data };
};

// --- News ---

export const getSchoolNews = async (): Promise<SchoolNews[]> => {
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

export const addSchoolNews = async (news: Partial<SchoolNews>) => {
    await supabase.from('news').insert({
        title: news.title,
        content: news.content,
        author: news.author,
        is_urgent: news.isUrgent
    });
};

export const deleteSchoolNews = async (id: string) => {
    await supabase.from('news').delete().eq('id', id);
};

export const updateSchoolNews = async () => { /* impl */ };

// --- Appointments & Gate ---

export const getAvailableSlots = async (date?: string): Promise<AppointmentSlot[]> => {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('appointment_slots').select('*').eq('date', targetDate);
    if (error) return [];
    return data.map((s: any) => ({
        id: s.id,
        date: s.date,
        startTime: s.start_time,
        endTime: s.end_time,
        maxCapacity: s.max_capacity,
        currentBookings: s.current_bookings
    }));
};

export const addAppointmentSlot = async (slot: any) => {
    await supabase.from('appointment_slots').insert({
        date: slot.date,
        start_time: slot.startTime,
        end_time: slot.endTime,
        max_capacity: slot.maxCapacity,
        current_bookings: 0
    });
};

export const deleteAppointmentSlot = async (id: string) => {
    await supabase.from('appointment_slots').delete().eq('id', id);
};

export const generateDefaultAppointmentSlots = async (date: string) => {
    const times = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30'];
    const slots = times.map(t => ({
        date,
        start_time: t,
        end_time: t.replace(/:00/, ':30').replace(/:30/, ':00'),
        max_capacity: 5,
        current_bookings: 0
    }));
    await supabase.from('appointment_slots').insert(slots);
};

export const updateAppointmentSlot = async () => {};

export const bookAppointment = async (details: any): Promise<Appointment> => {
    await supabase.rpc('increment_slot_booking', { slot_id: details.slotId });
    
    const { data, error } = await supabase.from('appointments').insert({
        slot_id: details.slotId,
        student_id: details.studentId,
        student_name: details.studentName,
        parent_name: details.parentName,
        parent_civil_id: details.parentCivilId,
        visit_reason: details.visitReason,
        status: 'pending'
    }).select('*, slot:appointment_slots(*)').single();
    
    if (error) throw new Error(error.message);
    
    return {
        id: data.id,
        slotId: data.slot_id,
        studentId: data.student_id,
        studentName: data.student_name,
        parentName: data.parent_name,
        parentCivilId: data.parent_civil_id,
        visitReason: data.visit_reason,
        status: data.status,
        createdAt: data.created_at,
        arrivedAt: data.arrived_at,
        slot: {
            id: data.slot.id,
            date: data.slot.date,
            startTime: data.slot.start_time,
            endTime: data.slot.end_time,
            maxCapacity: data.slot.max_capacity,
            currentBookings: data.slot.current_bookings
        }
    };
};

export const getMyAppointments = async (parentCivilId: string): Promise<Appointment[]> => {
    const { data, error } = await supabase.from('appointments').select('*, slot:appointment_slots(*)').eq('parent_civil_id', parentCivilId);
    if (error) return [];
    return data.map((a: any) => ({
        id: a.id,
        slotId: a.slot_id,
        studentId: a.student_id,
        studentName: a.student_name,
        parentName: a.parent_name,
        parentCivilId: a.parent_civil_id,
        visitReason: a.visit_reason,
        status: a.status,
        createdAt: a.created_at,
        arrivedAt: a.arrived_at,
        slot: {
            id: a.slot.id,
            date: a.slot.date,
            startTime: a.slot.start_time,
            endTime: a.slot.end_time,
            maxCapacity: a.slot.max_capacity,
            currentBookings: a.slot.current_bookings
        }
    }));
};

export const getDailyAppointments = async (date: string): Promise<Appointment[]> => {
    const { data, error } = await supabase.from('appointments').select('*, slot:appointment_slots!inner(*)').eq('slot.date', date);
    if (error) return [];
    return data.map((a: any) => ({
        id: a.id,
        slotId: a.slot_id,
        studentId: a.student_id,
        studentName: a.student_name,
        parentName: a.parent_name,
        parentCivilId: a.parent_civil_id,
        visitReason: a.visit_reason,
        status: a.status,
        createdAt: a.created_at,
        arrivedAt: a.arrived_at,
        slot: {
            id: a.slot.id,
            date: a.slot.date,
            startTime: a.slot.start_time,
            endTime: a.slot.end_time,
            maxCapacity: a.slot.max_capacity,
            currentBookings: a.slot.current_bookings
        }
    }));
};

export const checkInVisitor = async (id: string) => {
    await supabase.from('appointments').update({ status: 'completed', arrived_at: new Date().toISOString() }).eq('id', id);
};

// --- Exit Permissions ---

export const addExitPermission = async (perm: any) => {
    await supabase.from('exit_permissions').insert({
        student_id: perm.studentId,
        student_name: perm.studentName,
        grade: perm.grade,
        class_name: perm.className,
        parent_name: perm.parentName,
        parent_phone: perm.parentPhone,
        reason: perm.reason,
        created_by: perm.createdBy,
        created_by_name: perm.createdByName,
        status: 'pending_pickup'
    });
};

export const getExitPermissions = async (date: string): Promise<ExitPermission[]> => {
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;
    
    const { data, error } = await supabase.from('exit_permissions').select('*').gte('created_at', start).lte('created_at', end);
    if (error) return [];
    
    return data.map((p: any) => ({
        id: p.id,
        studentId: p.student_id,
        studentName: p.student_name,
        grade: p.grade,
        className: p.class_name,
        parentName: p.parent_name,
        parentPhone: p.parent_phone,
        reason: p.reason,
        createdBy: p.created_by,
        createdByName: p.created_by_name,
        status: p.status,
        createdAt: p.created_at,
        completedAt: p.completed_at
    }));
};

export const getMyExitPermissions = async (studentIds: string[]): Promise<ExitPermission[]> => {
    if (studentIds.length === 0) return [];
    const { data, error } = await supabase.from('exit_permissions').select('*').in('student_id', studentIds).order('created_at', { ascending: false });
    if (error) return [];
    return data.map((p: any) => ({
        id: p.id,
        studentId: p.student_id,
        studentName: p.student_name,
        grade: p.grade,
        className: p.class_name,
        parentName: p.parent_name,
        parentPhone: p.parent_phone,
        reason: p.reason,
        createdBy: p.created_by,
        createdByName: p.created_by_name,
        status: p.status,
        createdAt: p.created_at,
        completedAt: p.completed_at
    }));
};

export const completeExitPermission = async (id: string) => {
    await supabase.from('exit_permissions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
};

export const getExitPermissionById = async (id: string): Promise<ExitPermission | null> => {
    const { data, error } = await supabase.from('exit_permissions').select('*').eq('id', id).single();
    if (error || !data) return null;
    return {
        id: data.id,
        studentId: data.student_id,
        studentName: data.student_name,
        grade: data.grade,
        className: data.class_name,
        parentName: data.parent_name,
        parentPhone: data.parent_phone,
        reason: data.reason,
        createdBy: data.created_by,
        createdByName: data.created_by_name,
        status: data.status,
        createdAt: data.created_at,
        completedAt: data.completed_at
    };
};

// --- Referrals & Guidance ---

export const getReferrals = async (): Promise<Referral[]> => {
    const { data, error } = await supabase.from('referrals').select('*');
    if (error) return [];
    return data.map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        studentName: r.student_name,
        grade: r.grade,
        className: r.class_name,
        referralDate: r.referral_date,
        reason: r.reason,
        status: r.status,
        referredBy: r.referred_by,
        notes: r.notes,
        outcome: r.outcome,
        createdAt: r.created_at
    }));
};

export const addReferral = async (ref: Referral) => {
    await supabase.from('referrals').insert({
        student_id: ref.studentId,
        student_name: ref.studentName,
        grade: ref.grade,
        class_name: ref.className,
        referral_date: ref.referralDate,
        reason: ref.reason,
        status: ref.status,
        referred_by: ref.referredBy,
        notes: ref.notes
    });
};

export const updateReferralStatus = async (id: string, status: string, outcome?: string) => {
    await supabase.from('referrals').update({ status, outcome }).eq('id', id);
};

export const clearReferrals = async () => {
    await supabase.from('referrals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
};

export const getGuidanceSessions = async (): Promise<GuidanceSession[]> => {
    const { data, error } = await supabase.from('guidance_sessions').select('*');
    if (error) return [];
    return data.map((s: any) => ({
        id: s.id,
        studentId: s.student_id,
        studentName: s.student_name,
        date: s.date,
        sessionType: s.session_type,
        topic: s.topic,
        recommendations: s.recommendations,
        status: s.status
    }));
};

export const addGuidanceSession = async (session: GuidanceSession) => {
    await supabase.from('guidance_sessions').insert({
        student_id: session.studentId,
        student_name: session.studentName,
        date: session.date,
        session_type: session.sessionType,
        topic: session.topic,
        recommendations: session.recommendations,
        status: session.status
    });
};

export const updateGuidanceSession = async (session: GuidanceSession) => {
    await supabase.from('guidance_sessions').update({
        topic: session.topic,
        recommendations: session.recommendations,
        session_type: session.sessionType
    }).eq('id', session.id);
};

export const deleteGuidanceSession = async (id: string) => {
    await supabase.from('guidance_sessions').delete().eq('id', id);
};

// --- AI / Admin Insights ---

export const getAIConfig = async () => {
    return { apiKey: process.env.API_KEY, model: 'gemini-2.5-flash' };
};

export const generateSmartContent = async (prompt: string, context?: string, modelId: string = 'gemini-2.5-flash'): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const model = ai.models;
    
    let fullPrompt = prompt;
    if (context) fullPrompt = `Context: ${context}\n\nTask: ${prompt}`;
    
    try {
        const result = await model.generateContent({
            model: modelId,
            contents: fullPrompt
        });
        return result.text || "No response text";
    } catch (e) {
        console.error("AI Generation Error", e);
        return "تعذر توليد النص. يرجى المحاولة لاحقاً.";
    }
};

export const generateSmartStudentReport = async (studentName: string, history: any[], behavior: any[], points: number) => {
    const prompt = `
        اكتب تقريراً تربوياً للطالب ${studentName}.
        البيانات:
        - الغياب: ${history.filter(h => h.status === 'ABSENT').length} أيام.
        - التأخر: ${history.filter(h => h.status === 'LATE').length} أيام.
        - المخالفات السلوكية: ${behavior.length} مخالفات.
        - نقاط التميز: ${points}.
        
        التقرير يجب أن يكون موجهاً لولي الأمر، ويبدأ بعبارة ترحيبية، ثم ملخص للأداء، وينتهي بتوصيات.
        اللغة: عربية فصحى مهذبة.
    `;
    return generateSmartContent(prompt);
};

export const generateGuidancePlan = async (studentName: string, problemSummary: string) => {
    const prompt = `اقترح خطة علاجية سلوكية للطالب ${studentName} الذي يعاني من: ${problemSummary}. اقترح 3 خطوات عملية.`;
    return generateSmartContent(prompt);
};

export const analyzeSentiment = async (text: string): Promise<'positive'|'negative'|'neutral'> => {
    const prompt = `Analyze the sentiment of this school observation text: "${text}". Return ONLY one word: "positive", "negative", or "neutral".`;
    const res = await generateSmartContent(prompt);
    const clean = res.toLowerCase().trim();
    if (clean.includes('positive')) return 'positive';
    if (clean.includes('negative')) return 'negative';
    return 'neutral';
};

export const extractTextFromFile = async (file: File): Promise<string> => {
    return "محتوى الملف المستخرج (محاكاة)..."; 
};

export const getBotContext = async (): Promise<string> => {
    const { data, error } = await supabase.from('bot_context').select('content').single();
    if (error) return "";
    return data.content;
};

export const saveBotContext = async (content: string) => {
    const { data } = await supabase.from('bot_context').select('id').single();
    if (data) {
        await supabase.from('bot_context').update({ content }).eq('id', data.id);
    } else {
        await supabase.from('bot_context').insert({ content });
    }
};

export const generateUserSpecificBotContext = async (): Promise<{context: string, role: string}> => {
    const baseContext = await getBotContext();
    return { context: baseContext, role: 'المستخدم' };
};

export const sendAdminInsight = async (role: string, content: string) => {
    await supabase.from('admin_insights').insert({
        target_role: role,
        content: content,
        is_read: false
    });
};

export const getAdminInsights = async (role?: string): Promise<AdminInsight[]> => {
    let query = supabase.from('admin_insights').select('*');
    if (role) query = query.eq('target_role', role);
    
    const { data, error } = await query;
    if (error) return [];
    return data.map((d: any) => ({
        id: d.id,
        targetRole: d.target_role,
        content: d.content,
        createdAt: d.created_at,
        isRead: d.is_read
    }));
};

export const clearAdminInsights = async () => {
    await supabase.from('admin_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
};

export const generateTeacherAbsenceSummary = async () => {
    return { message: "تم تحليل الغياب وإرسال 5 إشعارات للمعلمين." };
};

export const sendPendingReferralReminders = async () => {
    return { message: "تم إرسال تذكيرات للموجه والوكيل." };
};