CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'up',
  check_interval INTEGER NOT NULL DEFAULT 60,
  locations JSONB NOT NULL DEFAULT '[]',
  tags JSONB NOT NULL DEFAULT '[]',
  ssl_status TEXT NOT NULL DEFAULT 'none',
  ssl_expiry_days INTEGER NOT NULL DEFAULT 0,
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE response_time_checks (
  id BIGSERIAL PRIMARY KEY,
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
  value_ms INTEGER NOT NULL
);
CREATE INDEX idx_response_time_checks_website_id ON response_time_checks(website_id, "timestamp" DESC);

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_incidents_website_id ON incidents(website_id);

CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  email_address TEXT NOT NULL DEFAULT '',
  slack_enabled BOOLEAN NOT NULL DEFAULT false,
  slack_webhook TEXT NOT NULL DEFAULT '',
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_phone TEXT NOT NULL DEFAULT '',
  telegram_enabled BOOLEAN NOT NULL DEFAULT false,
  telegram_chat_id TEXT NOT NULL DEFAULT '',
  threshold_response_time INTEGER NOT NULL DEFAULT 500,
  threshold_ssl_days INTEGER NOT NULL DEFAULT 7
);

CREATE TABLE workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'starter',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  api_key TEXT NOT NULL DEFAULT ''
);
