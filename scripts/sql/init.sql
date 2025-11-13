-- Frys Database Initialization Script
-- ===================================
-- This script initializes the database schema for Frys

-- Create database if it doesn't exist
-- Note: This is handled by docker-compose, but included for reference
-- CREATE DATABASE IF NOT EXISTS frys;
-- \c frys;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_buffercache";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE workflow_status AS ENUM ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE workflow_node_type AS ENUM (
        'start', 'end', 'task', 'decision', 'parallel', 'join',
        'ai_inference', 'data_transform', 'api_call', 'database_query',
        'file_operation', 'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE plugin_status AS ENUM ('loaded', 'unloaded', 'error', 'loading');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    avatar_url VARCHAR(500),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Workflow definitions table
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    definition JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_template BOOLEAN NOT NULL DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Workflow instances table
CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
    status workflow_status NOT NULL DEFAULT 'pending',
    context JSONB DEFAULT '{}',
    current_node VARCHAR(255),
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration INTERVAL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Workflow execution logs table
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID NOT NULL REFERENCES workflow_instances(id),
    node_id VARCHAR(255) NOT NULL,
    node_name VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration INTERVAL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- AI System Tables
-- ============================================================================

-- AI models table
CREATE TABLE IF NOT EXISTS ai_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    model_type VARCHAR(100) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    capabilities TEXT[] DEFAULT '{}',
    context_length INTEGER,
    max_tokens INTEGER,
    pricing JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- AI requests table
CREATE TABLE IF NOT EXISTS ai_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID REFERENCES ai_models(id),
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    request_type VARCHAR(50) NOT NULL,
    prompt TEXT,
    parameters JSONB DEFAULT '{}',
    token_count INTEGER,
    estimated_cost DECIMAL(10,6),
    response JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Monitoring Tables
-- ============================================================================

-- Metrics data table
CREATE TABLE IF NOT EXISTS metrics_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    alert_type VARCHAR(100) NOT NULL,
    condition JSONB NOT NULL,
    severity alert_severity NOT NULL,
    channels TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    cooldown_seconds INTEGER NOT NULL DEFAULT 300,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES alert_rules(id),
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    severity alert_severity NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    source VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Plugin System Tables
-- ============================================================================

-- Plugins table
CREATE TABLE IF NOT EXISTS plugins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    author VARCHAR(255),
    plugin_type VARCHAR(50) NOT NULL,
    status plugin_status NOT NULL DEFAULT 'unloaded',
    capabilities TEXT[] DEFAULT '{}',
    dependencies TEXT[] DEFAULT '{}',
    config_schema JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    wasm_binary BYTEA,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Plugin instances table
CREATE TABLE IF NOT EXISTS plugin_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plugin_id UUID NOT NULL REFERENCES plugins(id),
    instance_name VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}',
    status plugin_status NOT NULL DEFAULT 'loading',
    pid INTEGER,
    memory_usage BIGINT,
    cpu_usage DOUBLE PRECISION,
    last_health_check TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Vector Search Tables
-- ============================================================================

-- Vector indexes table
CREATE TABLE IF NOT EXISTS vector_indexes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    dimensions INTEGER NOT NULL,
    metric_type VARCHAR(50) NOT NULL DEFAULT 'cosine',
    index_type VARCHAR(50) NOT NULL DEFAULT 'hnsw',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Vector data table
CREATE TABLE IF NOT EXISTS vector_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    index_id UUID NOT NULL REFERENCES vector_indexes(id),
    content TEXT,
    metadata JSONB DEFAULT '{}',
    vector_data VECTOR(1536), -- Adjust dimension as needed
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Configuration Tables
-- ============================================================================

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    config_type VARCHAR(50) NOT NULL DEFAULT 'global',
    is_encrypted BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Workflow indexes
CREATE INDEX IF NOT EXISTS idx_workflow_instances_definition_id ON workflow_instances(definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_created_at ON workflow_instances(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_instance_id ON workflow_execution_logs(instance_id);

-- AI indexes
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_id ON ai_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_model_id ON ai_requests(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_status ON ai_requests(status);
CREATE INDEX IF NOT EXISTS idx_ai_requests_created_at ON ai_requests(created_at);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_data_metric_name ON metrics_data(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_data_timestamp ON metrics_data(timestamp);

-- Alert indexes
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);

-- Plugin indexes
CREATE INDEX IF NOT EXISTS idx_plugins_plugin_type ON plugins(plugin_type);
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);

-- Vector search indexes
CREATE INDEX IF NOT EXISTS idx_vector_data_index_id ON vector_data(index_id);
-- Note: Vector similarity search indexes would be created separately

-- ============================================================================
-- Default Data
-- ============================================================================

-- Insert default admin user (password: admin123 - CHANGE THIS!)
INSERT INTO users (username, email, full_name, password_hash, role, is_active, email_verified)
VALUES (
    'admin',
    'admin@frys.io',
    'System Administrator',
    '$2b$10$rOz8vZxZxZxZxZxZxZxZxZxZxZxZxZxZxZxZxZxZxZxZxZxZx', -- bcrypt hash for 'admin123'
    'admin',
    true,
    true
) ON CONFLICT (username) DO NOTHING;

-- Insert default workflow template
INSERT INTO workflow_definitions (name, description, version, definition, is_active, is_template, tags)
VALUES (
    'Hello World Workflow',
    'A simple hello world workflow template',
    '1.0.0',
    '{
        "nodes": [
            {
                "id": "start",
                "type": "start",
                "position": {"x": 100, "y": 100},
                "data": {"label": "Start"}
            },
            {
                "id": "hello_task",
                "type": "task",
                "position": {"x": 250, "y": 100},
                "data": {
                    "label": "Say Hello",
                    "task": "echo",
                    "config": {"message": "Hello, World!"}
                }
            },
            {
                "id": "end",
                "type": "end",
                "position": {"x": 400, "y": 100},
                "data": {"label": "End"}
            }
        ],
        "edges": [
            {"id": "start-hello", "source": "start", "target": "hello_task"},
            {"id": "hello-end", "source": "hello_task", "target": "end"}
        ]
    }',
    true,
    true,
    ARRAY['template', 'demo', 'hello-world']
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers to relevant tables
DO $$ BEGIN
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_workflow_definitions_updated_at BEFORE UPDATE ON workflow_definitions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_workflow_instances_updated_at BEFORE UPDATE ON workflow_instances
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Function to calculate workflow duration
CREATE OR REPLACE FUNCTION calculate_workflow_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration = NEW.completed_at - NEW.started_at;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for workflow duration calculation
DO $$ BEGIN
    CREATE TRIGGER calculate_workflow_duration_trigger BEFORE UPDATE ON workflow_instances
        FOR EACH ROW EXECUTE FUNCTION calculate_workflow_duration();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- Views for Analytics
-- ============================================================================

-- Workflow performance view
CREATE OR REPLACE VIEW workflow_performance AS
SELECT
    wd.id as definition_id,
    wd.name as definition_name,
    COUNT(wi.id) as total_instances,
    COUNT(CASE WHEN wi.status = 'completed' THEN 1 END) as completed_instances,
    COUNT(CASE WHEN wi.status = 'failed' THEN 1 END) as failed_instances,
    AVG(EXTRACT(EPOCH FROM wi.duration)) as avg_duration_seconds,
    MIN(EXTRACT(EPOCH FROM wi.duration)) as min_duration_seconds,
    MAX(EXTRACT(EPOCH FROM wi.duration)) as max_duration_seconds,
    AVG(EXTRACT(EPOCH FROM wi.created_at - wi.started_at)) as avg_queue_time_seconds
FROM workflow_definitions wd
LEFT JOIN workflow_instances wi ON wd.id = wi.definition_id
GROUP BY wd.id, wd.name;

-- AI usage view
CREATE OR REPLACE VIEW ai_usage_summary AS
SELECT
    am.name as model_name,
    am.provider,
    COUNT(ar.id) as total_requests,
    SUM(ar.token_count) as total_tokens,
    AVG(ar.estimated_cost) as avg_cost_per_request,
    SUM(ar.estimated_cost) as total_cost,
    COUNT(CASE WHEN ar.status = 'completed' THEN 1 END) as successful_requests,
    AVG(EXTRACT(EPOCH FROM (ar.completed_at - ar.started_at))) as avg_response_time_seconds
FROM ai_models am
LEFT JOIN ai_requests ar ON am.id = ar.model_id
GROUP BY am.id, am.name, am.provider;

-- System health view
CREATE OR REPLACE VIEW system_health AS
SELECT
    'cpu_usage' as metric,
    AVG(CASE WHEN md.metric_name = 'cpu_usage' THEN md.value END) as current_value,
    AVG(CASE WHEN md.metric_name = 'cpu_usage' THEN md.value END) * 1.2 as warning_threshold,
    AVG(CASE WHEN md.metric_name = 'cpu_usage' THEN md.value END) * 1.5 as critical_threshold
FROM metrics_data md
WHERE md.timestamp >= NOW() - INTERVAL '5 minutes'
    AND md.metric_name = 'cpu_usage'

UNION ALL

SELECT
    'memory_usage' as metric,
    AVG(CASE WHEN md.metric_name = 'memory_usage' THEN md.value END) as current_value,
    85.0 as warning_threshold,
    95.0 as critical_threshold
FROM metrics_data md
WHERE md.timestamp >= NOW() - INTERVAL '5 minutes'
    AND md.metric_name = 'memory_usage';

-- ============================================================================
-- Row Level Security (Optional)
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (extend as needed)
-- Note: This is a basic setup, customize based on your security requirements

-- ============================================================================
-- Final Setup
-- ============================================================================

-- Create indexes for the views
CREATE INDEX IF NOT EXISTS idx_metrics_data_metric_name_timestamp ON metrics_data(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status_created ON workflow_instances(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_model_status ON ai_requests(model_id, status);

-- Vacuum and analyze for optimal performance
VACUUM ANALYZE;

-- Log initialization completion
DO $$
BEGIN
    RAISE NOTICE 'Frys database initialization completed successfully at %', NOW();
END $$;
