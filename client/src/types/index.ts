// ============================================
// Nova-Scheduler — Client TypeScript Types
// ============================================

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

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  _count?: {
    queues: number;
  };
}

export interface RetryPolicy {
  id: string;
  name: string;
  type: RetryStrategyType;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface Queue {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  concurrencyLimit: number;
  maxRatePerMinute: number | null;
  isPaused: boolean;
  retryPolicyId: string | null;
  retryPolicy?: RetryPolicy | null;
  project?: {
    id: string;
    name: string;
  };
  _count?: {
    jobs: number;
    deadLetterEntries: number;
  };
}

export interface Job {
  id: string;
  name: string;
  type: JobType;
  status: JobStatus;
  payload: any;
  priority: number;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  scheduledAt: string | null;
  cronExpression: string | null;
  batchId: string | null;
  queueId: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  queue?: {
    id: string;
    name: string;
  };
  executions?: JobExecution[];
  logs?: JobLog[];
}

export interface JobExecution {
  id: string;
  jobId: string;
  workerId: string;
  attempt: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  errorStack: string | null;
  worker?: {
    id: string;
    name: string;
  };
}

export interface JobLog {
  id: string;
  jobId: string;
  timestamp: string;
  level: string;
  message: string;
  metadata: any;
}

export interface Worker {
  id: string;
  name: string;
  hostname: string | null;
  pid: number | null;
  concurrency: number;
  queues: string[];
  status: WorkerStatus;
  lastHeartbeat: string;
  _count?: {
    executions: number;
    heartbeats: number;
  };
  heartbeats?: WorkerHeartbeat[];
}

export interface WorkerHeartbeat {
  id: string;
  workerId: string;
  timestamp: string;
  status: WorkerStatus;
  activeJobs: number;
  cpuUsage: number | null;
  memoryUsage: number | null;
}

export interface DeadLetterEntry {
  id: string;
  originalJobId: string;
  queueId: string;
  reason: string;
  lastError: string | null;
  originalPayload: any;
  retryCount: number;
  failedAt: string;
  originalJob?: {
    id: string;
    name: string;
    type: JobType;
  };
  queue?: {
    id: string;
    name: string;
  };
}

export interface DashboardMetrics {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  successRate: number;
  avgExecutionTimeMs: number;
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
    isPaused: boolean;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetterCount: number;
  }>;
  workerUtilization: Array<{
    workerId: string;
    workerName: string;
    status: WorkerStatus;
    lastHeartbeat: string;
    totalExecuted: number;
  }>;
}

export enum SocketEvents {
  JOB_CREATED = 'job:created',
  JOB_CLAIMED = 'job:claimed',
  JOB_STARTED = 'job:started',
  JOB_COMPLETED = 'job:completed',
  JOB_FAILED = 'job:failed',
  JOB_RETRYING = 'job:retrying',
  QUEUE_PAUSED = 'queue:paused',
  QUEUE_RESUMED = 'queue:resumed',
  WORKER_ONLINE = 'worker:online',
  WORKER_OFFLINE = 'worker:offline',
  WORKER_HEARTBEAT = 'worker:heartbeat',
  METRICS_UPDATED = 'metrics:updated',
}
