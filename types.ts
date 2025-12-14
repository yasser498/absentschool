
export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface Student {
  id: string;
  name: string;
  studentId: string; // Civil ID / National ID
  grade: string;
  className: string;
  phone: string;
}

export interface ExcuseRequest {
  id: string;
  studentId: string; // Links to Student.studentId
  studentName: string; // Denormalized for easier display
  grade: string;
  className: string;
  date: string;
  reason: string;
  details?: string;
  attachmentName?: string;
  attachmentUrl?: string;
  status: RequestStatus;
}

export interface DashboardStats {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
}

// --- New Types for Attendance System ---

export interface ClassAssignment {
  grade: string;
  className: string;
}

export interface StaffUser {
  id: string;
  name: string;
  passcode: string; // Changed: Passcode only
  assignments: ClassAssignment[]; // Changed: Support multiple classes
  permissions?: string[]; // New: List of allowed feature keys
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE'
}

export interface AttendanceRecord {
  id: string;
  date: string;
  grade: string;
  className: string;
  staffId: string;
  records: {
    studentId: string;
    studentName: string;
    status: AttendanceStatus;
  }[];
}

export interface ResolvedAlert {
  studentId: string;
  dateResolved: string;
  actionType: string; // 'call', 'counselor', 'warning'
}

// --- Behavior System Types ---

export interface BehaviorRecord {
  id: string;
  studentId: string;
  studentName: string;
  grade: string;
  className: string;
  date: string;
  violationDegree: string; // First, Second, Third...
  violationName: string;
  articleNumber: string;
  actionTaken: string;
  notes?: string;
  staffId?: string;
  createdAt?: string;
  // Parent Feedback
  parentViewed?: boolean;
  parentFeedback?: string;
  parentViewedAt?: string;
}

export interface AdminInsight {
  id: string;
  targetRole: 'deputy' | 'counselor' | 'bot_context' | 'teachers';
  content: string;
  createdAt: string;
  isRead: boolean;
}

// Updated Referral for Workflow
export interface Referral {
  id: string;
  studentId: string;
  studentName: string;
  grade: string;
  className: string;
  referralDate: string;
  reason: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'returned_to_deputy';
  referredBy: 'admin' | 'deputy' | 'teacher';
  notes?: string;
  outcome?: string; // Result from counselor
  createdAt?: string;
}

// New: Guidance Session (For Counselor)
export interface GuidanceSession {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  sessionType: 'individual' | 'group' | 'parent_meeting';
  topic: string;
  recommendations: string;
  status: 'ongoing' | 'completed';
}

// --- الإضافات الجديدة ---

export interface StudentPoint {
  id: string;
  studentId: string;
  points: number;
  reason: string;
  type: 'behavior' | 'attendance' | 'academic' | 'honor';
  createdAt: string;
}

export interface AppNotification {
  id: string;
  targetUserId: string; // Parent ID or Student ID
  title: string;
  message: string;
  isRead: boolean;
  type: 'alert' | 'info' | 'success';
  createdAt: string;
}

export interface ParentLink {
  id: string;
  parentCivilId: string;
  studentId: string;
}

// تحديث واجهة الملاحظات لتشمل تحليل الذكاء الاصطناعي
export interface StudentObservation {
  id: string;
  studentId: string;
  studentName: string;
  grade: string;
  className: string;
  date: string;
  type: 'academic' | 'behavioral' | 'positive' | 'general';
  content: string;
  staffId: string;
  staffName: string;
  createdAt?: string;
  parentViewed?: boolean;
  parentFeedback?: string;
  parentViewedAt?: string;
  // AI Fields
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface SchoolNews {
  id: string;
  title: string;
  content: string;
  author: string;
  isUrgent: boolean;
  createdAt: string;
}

// New Types for Appointments
export interface AppointmentSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  currentBookings: number;
}

export interface Appointment {
  id: string;
  slotId: string;
  studentId: string;
  studentName: string;
  parentName: string;
  parentCivilId: string;
  visitReason: string;
  status: 'pending' | 'completed' | 'cancelled' | 'missed';
  arrivedAt?: string;
  slot?: AppointmentSlot; // Joined data
  createdAt: string;
}

// New Type for Student Exit Permission (Istithan)
export interface ExitPermission {
  id: string;
  studentId: string;
  studentName: string;
  grade: string;
  className: string;
  parentName: string;
  parentPhone: string;
  reason?: string;
  createdBy: string;
  createdByName?: string; // New: Authorizer Name
  status: 'pending_pickup' | 'completed' | 'expired';
  createdAt: string;
  completedAt?: string;
}
