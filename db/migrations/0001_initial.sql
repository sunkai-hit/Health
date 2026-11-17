-- Health V0.1 conceptual migration for SQLite-compatible databases.
-- SYNTHETIC DATA ONLY. This does NOT implement encryption, identity, authorization,
-- consent checks, file scanning, AI safety or secure production deployment.
-- Sensitive payload columns are BLOBs intended for application-layer encryption.
-- The application must implement key management, validation, user-scope checks,
-- transactional writes, retention/deletion and audit before handling real records.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_accounts (
  id TEXT PRIMARY KEY,
  auth_subject TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','deletion_requested')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS health_profiles (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  label_ciphertext BLOB,
  profile_ciphertext BLOB,
  encryption_key_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS idx_profiles_owner ON health_profiles(owner_user_id);

CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('health_storage','external_ai','ocr','report_share','other')),
  policy_version TEXT NOT NULL,
  granted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  CHECK (granted_at IS NOT NULL OR revoked_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_consent_user_purpose ON consent_records(user_id,purpose,created_at);

CREATE TABLE IF NOT EXISTS health_events (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  title_ciphertext BLOB NOT NULL,
  onset_at TEXT,
  onset_precision TEXT NOT NULL DEFAULT 'unknown' CHECK (onset_precision IN ('exact','approximate','unknown')),
  timezone TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  recurrence_of_event_id TEXT REFERENCES health_events(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_events_profile_status ON health_events(profile_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS event_entries (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES health_events(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('symptom','observation','note','change','test')),
  occurred_at TEXT,
  occurred_precision TEXT NOT NULL DEFAULT 'unknown' CHECK (occurred_precision IN ('exact','approximate','unknown')),
  source_type TEXT NOT NULL DEFAULT 'self_report' CHECK (source_type IN ('self_report','document_transcribed','ocr_draft','verified_import','ai_generated')),
  payload_ciphertext BLOB NOT NULL,
  encryption_key_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_entries_event_time ON event_entries(event_id,occurred_at,created_at);

CREATE TABLE IF NOT EXISTS body_marks (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES event_entries(id) ON DELETE CASCADE,
  map_version TEXT NOT NULL,
  view TEXT NOT NULL CHECK (view IN ('front','back','unspecified')),
  mark_ciphertext BLOB NOT NULL,
  encryption_key_version TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_marks_entry ON body_marks(entry_id);

CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES health_events(id) ON DELETE CASCADE,
  occurred_at TEXT,
  source_type TEXT NOT NULL DEFAULT 'self_report' CHECK (source_type IN ('self_report','document_transcribed','ocr_draft','verified_import')),
  details_ciphertext BLOB,
  followup_order_id TEXT, -- Backward reference validated by app; FK added via next migration only if needed.
  encryption_key_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_encounters_event_time ON encounters(event_id,occurred_at);

CREATE TABLE IF NOT EXISTS clinician_orders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES health_events(id) ON DELETE CASCADE,
  encounter_id TEXT REFERENCES encounters(id) ON DELETE SET NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('prescription','treatment','test','followup','lifestyle','other')),
  issued_at TEXT,
  source_type TEXT NOT NULL DEFAULT 'self_report' CHECK (source_type IN ('self_report','document_transcribed','ocr_draft','verified_import')),
  user_execution_status TEXT NOT NULL DEFAULT 'unknown' CHECK (user_execution_status IN ('unknown','not_started','in_progress','reported_completed')),
  supersedes_order_id TEXT REFERENCES clinician_orders(id) ON DELETE SET NULL,
  due_date_original TEXT,
  original_text_ciphertext BLOB,
  encryption_key_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at TEXT,
  CHECK (supersedes_order_id IS NULL OR supersedes_order_id <> id)
);
CREATE INDEX IF NOT EXISTS idx_orders_event_time ON clinician_orders(event_id,issued_at);
CREATE INDEX IF NOT EXISTS idx_orders_encounter ON clinician_orders(encounter_id);
CREATE INDEX IF NOT EXISTS idx_orders_replaces ON clinician_orders(supersedes_order_id);

CREATE TABLE IF NOT EXISTS prescription_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES clinician_orders(id) ON DELETE CASCADE,
  item_position INTEGER NOT NULL DEFAULT 0 CHECK (item_position >= 0),
  item_ciphertext BLOB NOT NULL,
  encryption_key_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  UNIQUE(order_id,item_position)
);
CREATE INDEX IF NOT EXISTS idx_prescription_items_order ON prescription_items(order_id);

CREATE TABLE IF NOT EXISTS medication_uses (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES health_events(id) ON DELETE CASCADE,
  instruction_id TEXT REFERENCES clinician_orders(id) ON DELETE SET NULL,
  prescription_item_id TEXT REFERENCES prescription_items(id) ON DELETE SET NULL,
  occurred_at TEXT,
  occurred_precision TEXT NOT NULL DEFAULT 'unknown' CHECK (occurred_precision IN ('exact','approximate','unknown')),
  usage_status TEXT NOT NULL CHECK (usage_status IN ('actual','planned','not_taken','unknown')),
  source_type TEXT NOT NULL DEFAULT 'self_report' CHECK (source_type IN ('self_report','document_transcribed','ocr_draft','verified_import')),
  use_ciphertext BLOB NOT NULL,
  encryption_key_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at TEXT,
  CHECK (prescription_item_id IS NULL OR instruction_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_med_uses_event_time ON medication_uses(event_id,occurred_at);
CREATE INDEX IF NOT EXISTS idx_med_uses_order ON medication_uses(instruction_id,prescription_item_id);

CREATE TABLE IF NOT EXISTS treatments_performed (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES health_events(id) ON DELETE CASCADE,
  instruction_id TEXT REFERENCES clinician_orders(id) ON DELETE SET NULL,
  occurred_at TEXT,
  source_type TEXT NOT NULL DEFAULT 'self_report' CHECK (source_type IN ('self_report','document_transcribed','ocr_draft','verified_import')),
  details_ciphertext BLOB NOT NULL,
  encryption_key_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_treatments_event_time ON treatments_performed(event_id,occurred_at);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES health_events(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  sha256_hex TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','scanning','ready','rejected','deleted')),
  metadata_ciphertext BLOB,
  encryption_key_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_attachments_event_status ON attachments(event_id,status);

CREATE TABLE IF NOT EXISTS report_snapshots (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES health_profiles(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES health_events(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('previsit','full_course')),
  include_ai_appendix INTEGER NOT NULL DEFAULT 0 CHECK (include_ai_appendix IN (0,1)),
  source_snapshot_hash TEXT NOT NULL,
  report_ciphertext BLOB NOT NULL,
  encryption_key_version TEXT,
  confirmed_at TEXT,
  generated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_event ON report_snapshots(event_id,generated_at DESC);

CREATE TABLE IF NOT EXISTS record_revisions (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','delete','restore','link','unlink')),
  previous_version INTEGER,
  new_version INTEGER,
  changed_at TEXT NOT NULL,
  change_metadata_ciphertext BLOB
);
CREATE INDEX IF NOT EXISTS idx_revisions_resource ON record_revisions(resource_type,resource_id,changed_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES user_accounts(id) ON DELETE SET NULL,
  action_code TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  request_id TEXT,
  result_code TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_events(occurred_at DESC);

-- SECURITY GATES NOT IMPLEMENTED IN SQL:
-- 1. Every query/write needs server-side user ownership validation.
-- 2. Any referenced order/item/encounter must belong to the same owner AND event.
-- 3. "verified_import" source requires an authenticated trusted integration route.
-- 4. Use versioned writes (If-Match) and idempotency keys at the API boundary.
-- 5. BLOB columns are not automatically encrypted by this migration.
-- 6. Object storage must be private, access-controlled, scanned and encrypted.
-- 7. No clinical AI risk classification until medical/regulatory verification.
