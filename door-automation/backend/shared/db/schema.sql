-- Door Automation Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table (customer door lists, blueprints, orders)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_name VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    project_type VARCHAR(50) NOT NULL, -- 'customer_list', 'blueprint', 'vendor_order'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB -- Additional flexible data
);

-- Line items (normalized door specifications)
CREATE TABLE line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,

    -- Normalized door specifications
    width_inches DECIMAL(5,2),
    height_inches DECIMAL(5,2),
    thickness_inches DECIMAL(5,2),
    vendor_code VARCHAR(50), -- e.g., "2468" = 24x68

    -- Door details
    door_type VARCHAR(100), -- 'hollow_metal', 'wood', 'fire_rated', etc.
    swing VARCHAR(20), -- 'LH', 'RH', 'LHR', 'RHR'
    jamb_type VARCHAR(50),
    fire_rating VARCHAR(20), -- '90min', '60min', etc.

    -- Pricing
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),

    -- Source and normalization
    raw_description TEXT, -- Original OCR text
    normalized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendor orders (generated CSV/orders sent to vendors)
CREATE TABLE vendor_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    vendor_name VARCHAR(255) NOT NULL,
    order_number VARCHAR(100),
    order_date DATE DEFAULT CURRENT_DATE,

    -- File references
    csv_file_path TEXT, -- MinIO path to vendor CSV
    sent_via VARCHAR(50) DEFAULT 'email', -- 'email', 'api', 'manual'
    sent_at TIMESTAMP,

    -- Status tracking
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'sent', 'acknowledged', 'discrepancy'

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Vendor acknowledgments (parsed acks from vendors)
CREATE TABLE vendor_acknowledgments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_order_id UUID REFERENCES vendor_orders(id) ON DELETE CASCADE,

    -- File references
    ack_file_path TEXT NOT NULL, -- MinIO path to vendor ack PDF
    parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- OCR metadata
    ocr_confidence DECIMAL(5,2), -- Average confidence score
    ocr_method VARCHAR(50), -- 'openai_vision', 'tesseract', 'pdf_text'

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_data JSONB -- Full OCR output
);

-- Acknowledgment line items (parsed from vendor ack)
CREATE TABLE ack_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ack_id UUID REFERENCES vendor_acknowledgments(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,

    -- Parsed specifications
    width_inches DECIMAL(5,2),
    height_inches DECIMAL(5,2),
    thickness_inches DECIMAL(5,2),
    vendor_code VARCHAR(50),
    quantity INTEGER,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),

    -- Matching
    matched_line_item_id UUID REFERENCES line_items(id),

    raw_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comparison results (original order vs ack)
CREATE TABLE comparisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_order_id UUID REFERENCES vendor_orders(id) ON DELETE CASCADE,
    ack_id UUID REFERENCES vendor_acknowledgments(id) ON DELETE CASCADE,

    -- Comparison summary
    total_lines_compared INTEGER,
    lines_matched INTEGER,
    lines_mismatched INTEGER,

    -- Tolerance settings used
    price_tolerance_percent DECIMAL(5,2) DEFAULT 2.0,
    size_tolerance_inches DECIMAL(5,2) DEFAULT 0.25,

    -- Results
    has_discrepancies BOOLEAN DEFAULT FALSE,
    mismatch_pdf_path TEXT, -- MinIO path to generated mismatch PDF

    compared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB -- Detailed mismatch data
);

-- Mismatch details (line-by-line comparison)
CREATE TABLE mismatch_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comparison_id UUID REFERENCES comparisons(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,

    original_line_item_id UUID REFERENCES line_items(id),
    ack_line_item_id UUID REFERENCES ack_line_items(id),

    -- Mismatch type
    mismatch_type VARCHAR(50), -- 'price', 'size', 'quantity', 'missing', 'extra'

    -- Original vs Ack values
    original_value TEXT,
    ack_value TEXT,
    difference TEXT,

    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job queue tracking (BullMQ jobs)
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(100) NOT NULL, -- 'ocr-ack', 'compare', 'generate-pdf', 'send-email'
    job_id VARCHAR(255) UNIQUE, -- BullMQ job ID
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'failed', 'delayed'
    progress INTEGER DEFAULT 0, -- 0-100

    -- Timing
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Results
    result JSONB,
    error TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendor settings (tolerance configs per vendor)
CREATE TABLE vendor_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_name VARCHAR(255) UNIQUE NOT NULL,

    -- Tolerance overrides
    price_tolerance_percent DECIMAL(5,2) DEFAULT 2.0,
    size_tolerance_inches DECIMAL(5,2) DEFAULT 0.25,

    -- Vendor specifics
    email VARCHAR(255),
    api_endpoint TEXT,
    preferred_contact_method VARCHAR(50) DEFAULT 'email',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settings JSONB -- Additional vendor-specific configs
);

-- Audit log (track all actions)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50), -- 'project', 'job', 'comparison', etc.
    entity_id UUID,
    action VARCHAR(100), -- 'created', 'updated', 'deleted', 'approved', 'sent'
    user_id VARCHAR(255), -- For future auth
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_line_items_project_id ON line_items(project_id);
CREATE INDEX idx_vendor_orders_project_id ON vendor_orders(project_id);
CREATE INDEX idx_vendor_acks_order_id ON vendor_acknowledgments(vendor_order_id);
CREATE INDEX idx_ack_line_items_ack_id ON ack_line_items(ack_id);
CREATE INDEX idx_comparisons_order_id ON comparisons(vendor_order_id);
CREATE INDEX idx_mismatch_details_comparison_id ON mismatch_details(comparison_id);
CREATE INDEX idx_jobs_project_id ON jobs(project_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_job_id ON jobs(job_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_items_updated_at BEFORE UPDATE ON line_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_orders_updated_at BEFORE UPDATE ON vendor_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_acks_updated_at BEFORE UPDATE ON vendor_acknowledgments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_settings_updated_at BEFORE UPDATE ON vendor_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
