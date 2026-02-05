-- ============= CREATE DATABASE =============
-- Run once: createdb llmcouncil

-- ============= USERS TABLE =============
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  api_keys_encrypted TEXT,          -- Encrypted JSON: {google, openai, anthropic}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email ON users(email);

-- ============= SESSIONS TABLE =============
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jwt_token_hash VARCHAR(255),       -- Hash of JWT (for invalidation)
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_user_expires ON sessions(user_id, expires_at);

-- ============= CONSENSUS REPORTS TABLE =============
CREATE TABLE IF NOT EXISTS consensus_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_query TEXT NOT NULL,
  query_hash VARCHAR(64),             -- SHA256 hash for deduplication
  image_stored_path TEXT,             -- Path to uploaded image (if any)
  status VARCHAR(20) DEFAULT 'pending', -- pending | processing | complete | error
  error_message TEXT,                 -- If status = error
  
  -- Final results
  priority_score INTEGER,             -- 1-10
  root_cause TEXT,
  recommended_action TEXT,
  internal_note TEXT,
  consensus_rate FLOAT,               -- 0.0-1.0 (agent agreement)
  
  -- Metadata
  processing_time_ms INTEGER,         -- Total time to analyze
  total_tokens_used INTEGER,
  estimated_cost DECIMAL(10, 4),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_priority CHECK (priority_score IS NULL OR (priority_score >= 1 AND priority_score <= 10))
);
CREATE INDEX IF NOT EXISTS idx_reports_by_date ON consensus_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_by_user ON consensus_reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status ON consensus_reports(status);

-- ============= AGENT RESPONSES TABLE =============
CREATE TABLE IF NOT EXISTS agent_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES consensus_reports(id) ON DELETE CASCADE,
  agent_name VARCHAR(50) NOT NULL,    -- vision | technical | empathy | chairperson
  
  -- Response data (stored as JSON for flexibility)
  response_json JSONB NOT NULL,       -- Full agent output
  
  -- Metadata
  processing_time_ms INTEGER,
  token_usage INTEGER,
  confidence_score FLOAT,
  pii_detected BOOLEAN DEFAULT false,
  error_occurred BOOLEAN DEFAULT false,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_confidence CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);
CREATE INDEX IF NOT EXISTS idx_report_agent ON agent_responses(report_id, agent_name);

-- ============= USAGE METRICS TABLE =============
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_hour TIMESTAMP NOT NULL,       -- Grouped by hour for cost tracking
  
  request_count INTEGER DEFAULT 1,
  token_count INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 4) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, date_hour),
  CONSTRAINT positive_values CHECK (request_count > 0 AND token_count >= 0)
);
CREATE INDEX IF NOT EXISTS idx_user_hour ON usage_metrics(user_id, date_hour DESC);

-- ============= SECURITY AUDIT LOG =============
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  
  event_type VARCHAR(50) NOT NULL,    -- pii_detected | injection_blocked | rate_limit_exceeded | key_accessed
  severity VARCHAR(20) NOT NULL,      -- low | medium | high | critical
  
  ip_address INET,
  user_agent TEXT,
  
  -- Details (what triggered the event)
  details JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);
CREATE INDEX IF NOT EXISTS idx_audit_by_severity ON security_audit_log(severity, created_at DESC);

-- ============= VIEW FOR ANALYTICS =============
CREATE OR REPLACE VIEW user_analytics AS
SELECT
  u.id as user_id,
  u.email,
  COUNT(DISTINCT cr.id) as total_analyses,
  AVG(cr.priority_score) as avg_priority,
  AVG(cr.consensus_rate) as avg_consensus,
  SUM(cr.total_tokens_used) as total_tokens,
  SUM(cr.estimated_cost) as total_cost,
  MAX(cr.created_at) as last_analysis,
  COUNT(CASE WHEN cr.status = 'error' THEN 1 END) as failed_analyses
FROM users u
LEFT JOIN consensus_reports cr ON u.id = cr.user_id
GROUP BY u.id, u.email;
