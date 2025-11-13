-- Phase 4: OCR & ASR Pipeline - Mapping Tables
-- Task 14: Text Normalization and Intelligent Mapping

-- SKU Aliases Table
-- Stores learned mappings from customer SKUs to catalog products
CREATE TABLE IF NOT EXISTS sku_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_sku TEXT NOT NULL,
  catalog_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  times_used INTEGER DEFAULT 1,
  UNIQUE(customer_sku, catalog_product_id)
);

CREATE INDEX idx_sku_aliases_customer_sku ON sku_aliases(customer_sku);
CREATE INDEX idx_sku_aliases_catalog_product_id ON sku_aliases(catalog_product_id);

-- Description Mappings Table
-- Stores learned mappings from customer descriptions to catalog products
CREATE TABLE IF NOT EXISTS description_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_description TEXT NOT NULL,
  catalog_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  times_used INTEGER DEFAULT 1,
  UNIQUE(customer_description, catalog_product_id)
);

CREATE INDEX idx_description_mappings_customer_description ON description_mappings(customer_description);
CREATE INDEX idx_description_mappings_catalog_product_id ON description_mappings(catalog_product_id);

-- Size Variations Table
-- Stores learned size format variations and their normalized forms
CREATE TABLE IF NOT EXISTS size_variations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant TEXT NOT NULL UNIQUE,
  normalized TEXT NOT NULL,
  width_inches INTEGER,
  height_inches INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_size_variations_variant ON size_variations(variant);
CREATE INDEX idx_size_variations_normalized ON size_variations(normalized);

-- Add status column to quote_lines if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lines' AND column_name = 'status'
  ) THEN
    ALTER TABLE quote_lines
    ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_review'));
  END IF;
END $$;

-- Add raw_text column to quote_lines to store original extracted text
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lines' AND column_name = 'raw_text'
  ) THEN
    ALTER TABLE quote_lines
    ADD COLUMN raw_text TEXT;
  END IF;
END $$;

-- Function to increment usage counters
CREATE OR REPLACE FUNCTION increment_mapping_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'sku_aliases' THEN
    UPDATE sku_aliases
    SET times_used = times_used + 1
    WHERE customer_sku = NEW.customer_sku
      AND catalog_product_id = NEW.catalog_product_id;
  ELSIF TG_TABLE_NAME = 'description_mappings' THEN
    UPDATE description_mappings
    SET times_used = times_used + 1
    WHERE customer_description = NEW.customer_description
      AND catalog_product_id = NEW.catalog_product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for usage tracking
CREATE TRIGGER sku_aliases_usage_trigger
  BEFORE INSERT ON sku_aliases
  FOR EACH ROW
  EXECUTE FUNCTION increment_mapping_usage();

CREATE TRIGGER description_mappings_usage_trigger
  BEFORE INSERT ON description_mappings
  FOR EACH ROW
  EXECUTE FUNCTION increment_mapping_usage();

-- Comments for documentation
COMMENT ON TABLE sku_aliases IS 'Learned mappings from customer SKUs to catalog products for intelligent SKU resolution';
COMMENT ON TABLE description_mappings IS 'Learned mappings from customer descriptions to catalog products for fuzzy matching';
COMMENT ON TABLE size_variations IS 'Learned size format variations (e.g., "3''0\" x 6''8\"" → "30x80") for normalization';

COMMENT ON COLUMN sku_aliases.times_used IS 'Number of times this mapping has been successfully used';
COMMENT ON COLUMN description_mappings.times_used IS 'Number of times this mapping has been successfully used';
COMMENT ON COLUMN size_variations.width_inches IS 'Normalized width in inches';
COMMENT ON COLUMN size_variations.height_inches IS 'Normalized height in inches';
