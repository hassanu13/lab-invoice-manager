-- =============================================================================
-- DSD Lab Invoice Manager — PostgreSQL schema (Phase 1)
-- Target: PostgreSQL 15+ on AWS RDS, eu-west-2 (London)
-- Author: Claude, for Dream Smiles Dental
-- Version: 1.0
-- =============================================================================
--
-- Design notes
-- ------------
-- 1. UUID primary keys throughout. Easier to generate client-side, harder to
--    enumerate, and avoids the integer-ID guessing class of bug.
-- 2. patient_name_encrypted is encrypted at the application layer using
--    AWS KMS-derived keys (envelope encryption). Stored as bytea. The DB never
--    sees the plaintext.
-- 3. site_id on every business-table row. Multi-tenancy from day one.
-- 4. Soft deletes via deleted_at where it matters (Patient, Clinician). Hard
--    delete on transient rows (Workflow Event is append-only and never deleted).
-- 5. Every business action is audit-logged via workflow_event + audit_log.
-- 6. All money columns: numeric(12,2). Pence-precise, GBP only.
-- 7. created_at / updated_at on every row, set by trigger.
-- =============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";  -- case-insensitive text for emails

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Sites
-- ---------------------------------------------------------------------------
CREATE TABLE site (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,                  -- e.g. 'bolton'
  address_line1 text,
  address_line2 text,
  city          text,
  postcode      text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER site_updated BEFORE UPDATE ON site
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Seed: Bolton site
INSERT INTO site (name, slug, city) VALUES ('Dream Smiles Dental, Bolton', 'bolton', 'Bolton');

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('practice_manager', 'clinician', 'operations', 'finance', 'slt');

CREATE TABLE app_user (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          citext NOT NULL UNIQUE,
  full_name      text NOT NULL,
  phone          text,
  password_hash  text NOT NULL,         -- argon2id
  mfa_secret     text,                  -- TOTP secret, encrypted
  mfa_enrolled   boolean NOT NULL DEFAULT false,
  failed_logins  int NOT NULL DEFAULT 0,
  locked_until   timestamptz,
  last_login_at  timestamptz,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER app_user_updated BEFORE UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Per-site role assignment. A user can have different roles at different sites.
CREATE TABLE user_site_role (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  site_id     uuid REFERENCES site(id) ON DELETE CASCADE,  -- NULL = group-wide (SLT, Finance)
  role        user_role NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, site_id, role)
);
CREATE INDEX idx_usr_user ON user_site_role(user_id);
CREATE INDEX idx_usr_site ON user_site_role(site_id);

-- ---------------------------------------------------------------------------
-- Labs (vendors)
-- ---------------------------------------------------------------------------
CREATE TABLE lab (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL UNIQUE,
  contact_email   citext,
  contact_phone   text,
  payment_terms   text,                                  -- "Net 30", etc
  template_key    text,                                  -- match key for extractor (e.g. 'hall_dental')
  active          boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER lab_updated BEFORE UPDATE ON lab
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Seed: known labs.
-- Names below match the strings returned by extract_invoice.py's detect_lab().
-- That keeps the upload route's `findUnique({where: {name}})` lookup working
-- without a translation step. If the lab's legal/registered name differs,
-- store it in `notes` rather than `name`.
INSERT INTO lab (name, template_key) VALUES
  ('Hall Dental Studio',  'hall_dental'),
  ('Innovate Dental',     'innovate'),
  ('Dent8',               'dent8'),
  ('Invisalign',          'invisalign'),
  ('Digital Prosthetics', 'digital_prosthetics'),
  ('Avant Garde',         'avant_garde'),
  ('Boutique Whitening',  'boutique_whitening'),
  ('S4S',                 's4s'),
  ('Carl Kearney',        'carl_kearney'),
  ('3 Dental',            '3_dental'),
  ('Aesthetic World',     'aesthetic_world'),
  ('Vio Dental Lab',      'vio_dental');

-- ---------------------------------------------------------------------------
-- Clinicians
-- ---------------------------------------------------------------------------
CREATE TABLE clinician (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name             text NOT NULL,
  email                 citext,
  phone                 text,
  user_id               uuid UNIQUE REFERENCES app_user(id),  -- if they have a login
  deduction_percentage  numeric(5,2) NOT NULL DEFAULT 50.00,
  active                boolean NOT NULL DEFAULT true,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (deduction_percentage >= 0 AND deduction_percentage <= 100)
);
CREATE TRIGGER clinician_updated BEFORE UPDATE ON clinician
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Site assignments for clinicians
CREATE TABLE clinician_site (
  clinician_id uuid NOT NULL REFERENCES clinician(id) ON DELETE CASCADE,
  site_id      uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  PRIMARY KEY (clinician_id, site_id)
);

-- Seed: clinicians from existing data
INSERT INTO clinician (full_name) VALUES
  ('Dr Naveed Patel'),
  ('Dr Qasim Hussain'),
  ('Dr Harris Chaudhry'),
  ('Dr Musa Ali'),
  ('Dr Heba Ikram'),
  ('Dr Mohammed Bux'),
  ('Dr Ibrahim Ali'),
  ('Dr Divyesh Sonigra'),
  ('Dr El Hussein');

-- ---------------------------------------------------------------------------
-- Patients (minimal record, encrypted name)
-- ---------------------------------------------------------------------------
CREATE TABLE patient (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id                  uuid NOT NULL REFERENCES site(id),
  patient_name_encrypted   bytea NOT NULL,             -- KMS envelope-encrypted
  patient_name_search_hash text NOT NULL,              -- HMAC-SHA256 for searchable lookup
  dentally_patient_id      text,                       -- optional, for future Dentally link
  deleted_at               timestamptz,                -- right-to-erasure flag
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER patient_updated BEFORE UPDATE ON patient
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE INDEX idx_patient_search ON patient(patient_name_search_hash);
CREATE INDEX idx_patient_site ON patient(site_id);

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
CREATE TYPE invoice_status AS ENUM (
  'uploaded',
  'pending_confirmation',
  'awaiting_clinician',
  'disputed',
  'awaiting_operations',
  'approved_for_finance',
  'paid',
  'rejected'
);

CREATE TABLE invoice (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id                uuid NOT NULL REFERENCES site(id),
  lab_id                 uuid NOT NULL REFERENCES lab(id),
  invoice_number         text NOT NULL,
  invoice_date           date NOT NULL,
  due_date               date,
  total_amount_gbp       numeric(12,2) NOT NULL CHECK (total_amount_gbp >= 0),
  outstanding_amount_gbp numeric(12,2) NOT NULL CHECK (outstanding_amount_gbp >= 0),
  status                 invoice_status NOT NULL DEFAULT 'uploaded',
  current_owner_user_id  uuid REFERENCES app_user(id),
  notes                  text,
  source_attachment_id   uuid,                                   -- forward-ref, set after attachment row
  paid_at                timestamptz,
  created_by_user_id     uuid REFERENCES app_user(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lab_id, invoice_number, site_id)
);
CREATE TRIGGER invoice_updated BEFORE UPDATE ON invoice
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE INDEX idx_invoice_site_status ON invoice(site_id, status);
CREATE INDEX idx_invoice_lab ON invoice(lab_id);
CREATE INDEX idx_invoice_owner ON invoice(current_owner_user_id);
CREATE INDEX idx_invoice_date ON invoice(invoice_date);
CREATE INDEX idx_invoice_due ON invoice(due_date) WHERE status NOT IN ('paid','rejected');

-- ---------------------------------------------------------------------------
-- Invoice lines (one line per patient/clinician on an invoice)
-- ---------------------------------------------------------------------------
CREATE TABLE invoice_line (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id               uuid NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  patient_id               uuid REFERENCES patient(id),
  clinician_id             uuid REFERENCES clinician(id),
  job_reference            text,            -- lab's internal job/order ref
  work_type                text,            -- crown, veneer, retainer, implant, whitening, other
  tooth_or_area            text,
  line_amount_gbp          numeric(12,2) NOT NULL CHECK (line_amount_gbp >= 0),
  clinician_deduction_gbp  numeric(12,2) NOT NULL DEFAULT 0 CHECK (clinician_deduction_gbp >= 0),
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER invoice_line_updated BEFORE UPDATE ON invoice_line
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE INDEX idx_line_invoice ON invoice_line(invoice_id);
CREATE INDEX idx_line_clinician ON invoice_line(clinician_id);
CREATE INDEX idx_line_patient ON invoice_line(patient_id);

-- ---------------------------------------------------------------------------
-- Attachments (the source PDFs and extraction JSON)
-- ---------------------------------------------------------------------------
CREATE TABLE attachment (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id          uuid REFERENCES invoice(id) ON DELETE CASCADE,
  s3_key              text NOT NULL UNIQUE,       -- e.g. invoices/2026/04/<uuid>.pdf
  original_filename   text NOT NULL,
  content_type        text NOT NULL DEFAULT 'application/pdf',
  byte_size           bigint NOT NULL,
  ocr_text            text,
  extraction_json     jsonb,
  extraction_confidence numeric(4,3),             -- 0.000 - 1.000
  template_used       text,                       -- which lab template matched, or NULL for AI-only
  uploaded_by_user_id uuid REFERENCES app_user(id),
  uploaded_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachment_invoice ON attachment(invoice_id);

-- Add the FK from invoice to attachment now that attachment exists
ALTER TABLE invoice
  ADD CONSTRAINT fk_invoice_source_attachment
  FOREIGN KEY (source_attachment_id) REFERENCES attachment(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Workflow events (audit trail of every state change)
-- ---------------------------------------------------------------------------
CREATE TABLE workflow_event (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id    uuid NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  from_status   invoice_status,
  to_status     invoice_status NOT NULL,
  actor_user_id uuid REFERENCES app_user(id),
  comment       text,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wfe_invoice ON workflow_event(invoice_id, occurred_at DESC);
CREATE INDEX idx_wfe_actor ON workflow_event(actor_user_id);

-- ---------------------------------------------------------------------------
-- Budgets (manual, per site, per month)
-- ---------------------------------------------------------------------------
CREATE TABLE budget (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id       uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  period_month  date NOT NULL,                  -- always first of month
  forecast_gbp  numeric(12,2) NOT NULL CHECK (forecast_gbp >= 0),
  notes         text,
  created_by_user_id uuid REFERENCES app_user(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, period_month)
);
CREATE TRIGGER budget_updated BEFORE UPDATE ON budget
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log (low-level — every read/write of patient data)
-- ---------------------------------------------------------------------------
CREATE TYPE audit_action AS ENUM ('read','create','update','delete','login','login_failed','export');

CREATE TABLE audit_log (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id uuid REFERENCES app_user(id),
  action        audit_action NOT NULL,
  entity_type   text NOT NULL,                       -- 'patient', 'invoice', etc
  entity_id     uuid,
  ip_address    inet,
  user_agent    text,
  details       jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON audit_log(actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_occurred ON audit_log(occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Sessions (server-side session tracking for security audit)
-- ---------------------------------------------------------------------------
CREATE TABLE session (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  ip_address  inet,
  user_agent  text,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_session_user ON session(user_id);
CREATE INDEX idx_session_expires ON session(expires_at) WHERE revoked_at IS NULL;

-- =============================================================================
-- Migration script (will be implemented as a Node.js one-shot in src/scripts/)
-- =============================================================================
-- Source: DSD_invoice_data_latest.json (147 invoices, 48 uploads)
--
-- Mapping plan:
--   uploads[i].fileName         -> attachment.original_filename
--   uploads[i].supplier         -> lab.name (lookup or insert)
--   uploads[i].site             -> site.slug ('bolton' present, '?' -> bolton default)
--   uploads[i].accountNo        -> attachment.extraction_json.account_no
--   invoices[i].invoice         -> invoice.invoice_number
--   invoices[i].date            -> invoice.invoice_date
--   invoices[i].origAmt         -> invoice.total_amount_gbp
--   invoices[i].balance         -> invoice.outstanding_amount_gbp
--   invoices[i].status (Paid/Unpaid) -> invoice.status (paid / approved_for_finance)
--   invoices[i].patient         -> patient.patient_name_encrypted (encrypt at import)
--   invoices[i].clinician       -> clinician.full_name (lookup or NULL)
--   invoices[i].notes           -> invoice_line.notes
--   invoices[i].job             -> invoice_line.job_reference
--
-- For each existing invoice, create:
--   1 row in invoice
--   1 row in invoice_line (existing data is one-line-per-invoice)
--   1 row in patient (encrypted)
--   1 row in attachment (linking the original PDF in S3)
--   1 row in workflow_event (status: imported -> current status)
-- =============================================================================
