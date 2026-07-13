CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (version) VALUES ('001_init') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'super-admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles were simplified from owner/admin/viewer down to super-admin/editor.
-- Remap any pre-existing rows and enforce the new set going forward.
UPDATE users SET role = 'super-admin' WHERE role IN ('owner', 'admin');
UPDATE users SET role = 'editor' WHERE role = 'viewer';
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'super-admin';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super-admin', 'editor'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS websites (
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

ALTER TABLE websites ADD COLUMN IF NOT EXISTS ssl_issuer TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS response_time_checks (
  id BIGSERIAL PRIMARY KEY,
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
  value_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_response_time_checks_website_id ON response_time_checks(website_id, "timestamp" DESC);

CREATE TABLE IF NOT EXISTS incidents (
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
CREATE INDEX IF NOT EXISTS idx_incidents_website_id ON incidents(website_id);

CREATE TABLE IF NOT EXISTS notification_settings (
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

CREATE TABLE IF NOT EXISTS workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'starter',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  api_key TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  recipient_email TEXT NOT NULL DEFAULT '',
  last_sent_at TIMESTAMPTZ
);

-- Backfill a disabled schedule row for any user created before this table existed.
INSERT INTO scheduled_reports (user_id, recipient_email)
SELECT u.id, COALESCE(n.email_address, '')
FROM users u
LEFT JOIN notification_settings n ON n.user_id = u.id
WHERE NOT EXISTS (SELECT 1 FROM scheduled_reports sr WHERE sr.user_id = u.id);

-- Support multiple alert recipients instead of a single email address.
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS email_addresses JSONB NOT NULL DEFAULT '[]';
UPDATE notification_settings
SET email_addresses = to_jsonb(ARRAY[email_address])
WHERE email_addresses = '[]'::jsonb AND email_address IS NOT NULL AND email_address != '';

-- Tracks the last SSL status we alerted on per site, so we only email once per
-- valid->expiring->expired transition instead of on every check.
ALTER TABLE websites ADD COLUMN IF NOT EXISTS ssl_alerted_status TEXT NOT NULL DEFAULT '';
