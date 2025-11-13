// Frys Admin UI - TypeScript Type Definitions

// ============================================================================
// Core System Types
// ============================================================================

export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  buildTime: string;
  environment: 'development' | 'staging' | 'production';
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    usage: number;
  };
  disk: {
    used: number;
    total: number;
    usage: number;
  };
  network: {
    rxBytes: number;
    txBytes: number;
    connections: number;
  };
}

// ============================================================================
// Workflow Types
// ============================================================================

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, any>;
    inputs?: WorkflowNodeIO[];
    outputs?: WorkflowNodeIO[];
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: {
    condition?: string;
    transform?: string;
  };
}

export interface WorkflowNodeIO {
  id: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file';
  required: boolean;
  defaultValue?: any;
}

export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'task'
  | 'decision'
  | 'parallel'
  | 'join'
  | 'ai_inference'
  | 'data_transform'
  | 'api_call'
  | 'database_query'
  | 'file_operation'
  | 'custom';

export interface WorkflowInstance {
  id: string;
  definitionId: string;
  status: WorkflowStatus;
  context: Record<string, any>;
  currentNode?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
}

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface WorkflowExecutionResult {
  nodeId: string;
  status: 'success' | 'error' | 'skipped';
  output: any;
  duration: number;
  executedAt: string;
  error?: string;
}

// ============================================================================
// Plugin Types
// ============================================================================

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: PluginType;
  status: PluginStatus;
  capabilities: string[];
  dependencies: string[];
  metadata: Record<string, any>;
}

export type PluginType = 'core' | 'system' | 'workflow' | 'ai' | 'storage' | 'network' | 'custom';

export type PluginStatus = 'loaded' | 'unloaded' | 'error' | 'loading';

export interface PluginMetrics {
  pluginId: string;
  memoryUsage: number;
  cpuUsage: number;
  invocationCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastActivity: string;
}

// ============================================================================
// AI System Types
// ============================================================================

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  modelType: AIModelType;
  capabilities: AICapability[];
  contextLength: number;
  status: 'available' | 'unavailable' | 'deprecated';
  metadata: Record<string, any>;
}

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'meta' | 'huggingface' | 'custom';

export type AIModelType = 'text-generation' | 'text-embedding' | 'image-generation' | 'speech-recognition' | 'multimodal';

export type AICapability = 'chat' | 'completion' | 'embedding' | 'image' | 'audio' | 'vision';

export interface AIRequest {
  id: string;
  model: string;
  prompt: string;
  parameters: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp: string;
}

export interface AIResponse {
  id: string;
  requestId: string;
  model: string;
  content: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  metadata: Record<string, any>;
  timestamp: string;
}

export interface AIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalTokens: number;
  cost: number;
  models: Record<string, AIModelMetrics>;
}

export interface AIModelMetrics {
  requests: number;
  tokens: number;
  cost: number;
  averageResponseTime: number;
  errorRate: number;
}

// ============================================================================
// Vector Search Types
// ============================================================================

export interface VectorSearchQuery {
  id: string;
  query: string;
  vector?: number[];
  topK: number;
  filters?: Record<string, any>;
  searchType: 'semantic' | 'hybrid' | 'exact';
  metadata: Record<string, any>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, any>;
  vector?: number[];
}

export interface VectorIndexStats {
  totalVectors: number;
  dimensions: number;
  indexSize: number;
  buildTime: number;
  lastUpdated: string;
  searchStats: {
    totalSearches: number;
    averageResponseTime: number;
    cacheHitRate: number;
  };
}

// ============================================================================
// Monitoring & Alerting Types
// ============================================================================

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
  tags: string[];
  data: Record<string, any>;
}

export type AlertType =
  | 'system'
  | 'workflow'
  | 'plugin'
  | 'ai'
  | 'network'
  | 'security'
  | 'performance';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: AlertType;
  severity: AlertSeverity;
  condition: AlertCondition;
  enabled: boolean;
  cooldown: number; // seconds
  channels: AlertChannel[];
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  threshold: number;
  duration?: number; // seconds
}

export interface AlertChannel {
  type: 'email' | 'webhook' | 'slack' | 'sms';
  config: Record<string, any>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface SystemConfig {
  general: {
    name: string;
    description: string;
    version: string;
    environment: string;
  };
  performance: {
    maxConcurrentWorkflows: number;
    maxConcurrentPlugins: number;
    cacheSize: number;
    workerThreads: number;
  };
  security: {
    enableAuth: boolean;
    jwtSecret: string;
    sessionTimeout: number;
    corsOrigins: string[];
  };
  monitoring: {
    enableMetrics: boolean;
    metricsInterval: number;
    enableTracing: boolean;
    logLevel: string;
  };
  ai: {
    defaultProvider: AIProvider;
    maxTokensPerRequest: number;
    requestTimeout: number;
    enableCaching: boolean;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    timestamp: string;
  };
}

// ============================================================================
// UI Component Types
// ============================================================================

export interface TableColumn<T = any> {
  key: keyof T;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, record: T) => React.ReactNode;
  width?: number | string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'alert' | 'workflow' | 'plugin';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout: 'grid' | 'masonry' | 'flex';
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// User & Permission Types
// ============================================================================

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  avatar?: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'manager' | 'developer' | 'operator' | 'viewer';

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
  scope?: 'global' | 'team' | 'project' | 'own';
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Required<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Date range for filtering
export interface DateRange {
  start: Date | string;
  end: Date | string;
}

// Search and filter parameters
export interface SearchParams {
  query?: string;
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Real-time event types
export interface RealtimeEvent {
  type: string;
  payload: any;
  timestamp: string;
  source: string;
}

// File upload types
export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}
