// ============================================
// Nova-Scheduler — Shared TypeScript Types
// ============================================

// ---- Enums ----

export enum JobStatus {
  QUEUED = 'QUEUED',
  SCHEDULED = 'SCHEDULED',
  CLAIMED = 'CLAIMED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  CANCELLED = 'CANCELLED',
  TIMED_OUT = 'TIMED_OUT',
}

export enum JobType {
  IMMEDIATE = 'IMMEDIATE',
  DELAYED = 'DELAYED',
  SCHEDULED = 'SCHEDULED',
  RECURRING = 'RECURRING',
  BATCH = 'BATCH',
}

export enum RetryStrategyType {
  FIXED = 'FIXED',
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL',
}

export enum WorkerStatus {
  IDLE = 'IDLE',
  BUSY = 'BUSY',
  DRAINING = 'DRAINING',
  OFFLINE = 'OFFLINE',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

// ---- API Response ----

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ---- Job Payloads ----

export interface HttpJobPayload {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  expectedStatus?: number;
}

export interface EmailJobPayload {
  to: string;
  subject: string;
  body: string;
  template?: string;
}

export interface ShellJobPayload {
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
}

export type JobPayload = HttpJobPayload | EmailJobPayload | ShellJobPayload | Record<string, unknown>;

// ---- Filters ----

export interface JobFilter extends PaginationQuery {
  status?: JobStatus;
  type?: JobType;
  priority?: number;
  queueId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface QueueFilter extends PaginationQuery {
  projectId?: string;
  isPaused?: boolean;
  search?: string;
}

// ---- Auth ----

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  orgId?: string;
}

export interface AuthenticatedRequest {
  user: JwtPayload;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}

// ---- Metrics ----

export interface DashboardMetrics {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  successRate: number;
  avgExecutionTime: number;
  jobsByStatus: Record<string, number>;
  jobsByType: Record<string, number>;
  throughput: Array<{
    date: string;
    completed: number;
    failed: number;
  }>;
  queueHealth: Array<{
    queueId: string;
    queueName: string;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }>;
  workerUtilization: Array<{
    workerId: string;
    workerName: string;
    activeJobs: number;
    totalExecuted: number;
    status: WorkerStatus;
  }>;
}

// ---- Socket Events ----

export enum SocketEvents {
  // Job events
  JOB_CREATED = 'job:created',
  JOB_CLAIMED = 'job:claimed',
  JOB_STARTED = 'job:started',
  JOB_COMPLETED = 'job:completed',
  JOB_FAILED = 'job:failed',
  JOB_RETRYING = 'job:retrying',

  // Queue events
  QUEUE_PAUSED = 'queue:paused',
  QUEUE_RESUMED = 'queue:resumed',
  QUEUE_STATS = 'queue:stats',

  // Worker events
  WORKER_ONLINE = 'worker:online',
  WORKER_OFFLINE = 'worker:offline',
  WORKER_HEARTBEAT = 'worker:heartbeat',

  // Dashboard
  METRICS_UPDATED = 'metrics:updated',
}
