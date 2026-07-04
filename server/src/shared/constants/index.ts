// ============================================
// Nova-Scheduler — Application Constants
// ============================================

export const APP_NAME = 'Nova-Scheduler';
export const API_PREFIX = '/api/v1';
export const SWAGGER_PATH = '/api-docs';

// Job defaults
export const DEFAULT_JOB_PRIORITY = 3; // MEDIUM (1=Critical, 5=Minimal)
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY_MS = 5000;
export const DEFAULT_TIMEOUT_MS = 30000;

// Pagination
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Rate limiting
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 100;

// Queue defaults
export const DEFAULT_QUEUE_CONCURRENCY = 5;
export const DEFAULT_QUEUE_MAX_RATE = 60; // per minute
export const QUEUE_POLL_INTERVAL_MS = 5000;

// Worker
export const MAX_CONCURRENT_WORKERS = 5;
export const WORKER_HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
export const WORKER_STALE_THRESHOLD_MS = 60000;    // 1 minute without heartbeat = stale

// Circuit breaker
export const CIRCUIT_BREAKER_THRESHOLD = 5;       // failures before opening
export const CIRCUIT_BREAKER_RESET_MS = 60000;     // 1 minute reset window
export const CIRCUIT_BREAKER_HALF_OPEN_MAX = 3;    // test requests in half-open

// Retry strategy defaults
export const RETRY_BASE_DELAY_MS = 1000;
export const RETRY_MAX_DELAY_MS = 300000; // 5 minutes max
export const RETRY_BACKOFF_MULTIPLIER = 2;
