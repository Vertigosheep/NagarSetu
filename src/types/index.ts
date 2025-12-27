// Core application types
export interface User {
  id: string;
  email: string;
  full_name: string;
  user_type: 'citizen' | 'authority' | 'official';
  department?: string;
  employee_id?: string;
  phone?: string;
  address?: string;
  created_at: string;
  is_onboarding_complete: boolean;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  location: string;
  category: IssueCategory;
  image?: string;
  after_image?: string;
  status: IssueStatus;
  urgency?: IssueUrgency;
  latitude?: number;
  longitude?: number;
  created_by: string;
  assigned_to?: string;
  department?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  show_in_gallery?: boolean;
  citizen_feedback?: 'satisfied' | 'not_satisfied';
  citizen_feedback_comment?: string;
  citizen_feedback_at?: string;
  comments_count: number;
  volunteers_count: number;
  upvotes_count?: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  status: EventStatus;
  time_remaining?: string;
  categories: string[];
  volunteers_count: number;
  created_by: string;
  created_at: string;
}

export interface Comment {
  id: string;
  content: string;
  issue_id: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

// Enums for better type safety
export type IssueCategory = 
  | 'Trash' 
  | 'Water' 
  | 'Infrastructure' 
  | 'Electricity' 
  | 'Drainage' 
  | 'Transportation'
  | 'Health'
  | 'Safety'
  | 'Other';

export type IssueStatus = 
  | 'reported'
  | 'assigned'
  | 'in_progress' 
  | 'pending_approval'
  | 'resolved' 
  | 'closed';

export type IssueUrgency = 
  | 'low' 
  | 'medium' 
  | 'high' 
  | 'critical';

export type EventStatus = 
  | 'upcoming' 
  | 'ongoing' 
  | 'completed' 
  | 'cancelled';

export type UserType = 'citizen' | 'authority' | 'official';

// API Response types
export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  hasMore: boolean;
  page: number;
  limit: number;
}

// Form types
export interface CreateIssueForm {
  title: string;
  description: string;
  location: string;
  category: IssueCategory;
  image?: File;
  latitude?: number;
  longitude?: number;
}

export interface CreateEventForm {
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  categories: string[];
}

export interface AuthForm {
  email: string;
  password: string;
  name?: string;
  userType?: UserType;
  department?: string;
  authorityAccessCode?: string;
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

// Map related types
export interface MapLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface MapMarker extends MapLocation {
  id: string;
  title: string;
  type: 'issue' | 'event';
  status?: string;
  urgency?: IssueUrgency;
}

// Notification types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  action_url?: string;
}

// Filter types
export interface IssueFilters {
  category?: IssueCategory;
  status?: IssueStatus;
  urgency?: IssueUrgency;
  location?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface EventFilters {
  status?: EventStatus;
  category?: string;
  location?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

// Authority specific types
export interface AuthorityDashboardStats {
  totalIssues: number;
  pendingIssues: number;
  resolvedIssues: number;
  assignedToMe: number;
  criticalIssues: number;
}

export interface IssueAssignment {
  issue_id: string;
  assigned_to: string;
  assigned_by: string;
  department: string;
  assigned_at: string;
  notes?: string;
}

/
/ Department Official specific types
export interface OfficialDashboardStats {
  new_assigned: number;
  in_progress: number;
  pending_approval: number;
  critical_count: number;
  total_assigned: number;
}

export interface IssueInternalNote {
  id: string;
  issue_id: string;
  official_id: string;
  note: string;
  created_at: string;
  updated_at: string;
  official_name?: string;
}

export interface OfficialTaskCard extends Issue {
  citizen_reports_count?: number;
  ai_severity?: string;
}
