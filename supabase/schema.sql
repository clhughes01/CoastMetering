-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    owner_name TEXT,
    water_utility TEXT,
    power_utility TEXT,
    gas_utility TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Units table
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_number TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(property_id, unit_number)
);

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    move_in_date DATE NOT NULL,
    move_out_date DATE,
    account_number TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meters table (for submeter devices)
CREATE TABLE IF NOT EXISTS meters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    meter_number TEXT NOT NULL,
    meter_type TEXT NOT NULL CHECK (meter_type IN ('water', 'power', 'gas')),
    device_type TEXT CHECK (device_type IN ('badger_orion', 'chinese_device')),
    device_identifier TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(unit_id, meter_type)
);

-- Meter readings table
CREATE TABLE IF NOT EXISTS meter_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
    reading_value DECIMAL(10, 2) NOT NULL,
    reading_date DATE NOT NULL,
    raw_data JSONB,
    source TEXT CHECK (source IN ('badger_orion', 'chinese_device', 'manual')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(meter_id, reading_date)
);

-- Utility bills table (for future billing functionality)
CREATE TABLE IF NOT EXISTS utility_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    bill_date DATE NOT NULL,
    water_reading_id UUID REFERENCES meter_readings(id),
    power_reading_id UUID REFERENCES meter_readings(id),
    gas_reading_id UUID REFERENCES meter_readings(id),
    total_amount DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(unit_id, month, year)
);

-- Users table (for authentication - admin and tenant roles)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'tenant')),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_tenants_unit_id ON tenants(unit_id);
CREATE INDEX IF NOT EXISTS idx_meters_unit_id ON meters(unit_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_meter_id ON meter_readings(meter_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_reading_date ON meter_readings(reading_date);
CREATE INDEX IF NOT EXISTS idx_utility_bills_unit_id ON utility_bills(unit_id);
CREATE INDEX IF NOT EXISTS idx_utility_bills_tenant_id ON utility_bills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_utility_bills_month_year ON utility_bills(month, year);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meters_updated_at BEFORE UPDATE ON meters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meter_readings_updated_at BEFORE UPDATE ON meter_readings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_utility_bills_updated_at BEFORE UPDATE ON utility_bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security Policies (basic setup - can be expanded)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow public access for development (will be restricted with authentication later)
CREATE POLICY "Allow public read access to properties" ON properties
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert to properties" ON properties
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to properties" ON properties
    FOR UPDATE USING (true);

-- Admin can see everything (for when auth is implemented)
-- CREATE POLICY "Admins can view all properties" ON properties
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM users
--             WHERE users.id = auth.uid()::uuid
--             AND users.role = 'admin'
--         )
--     );

-- Allow public access for development
CREATE POLICY "Allow public read access to units" ON units
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert to units" ON units
    FOR INSERT WITH CHECK (true);

-- CREATE POLICY "Admins can view all units" ON units
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM users
--             WHERE users.id = auth.uid()::uuid
--             AND users.role = 'admin'
--         )
--     );

-- Allow public access for development
CREATE POLICY "Allow public read access to tenants" ON tenants
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert to tenants" ON tenants
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access to meters" ON meters
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert to meters" ON meters
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access to meter_readings" ON meter_readings
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert to meter_readings" ON meter_readings
    FOR INSERT WITH CHECK (true);

-- Tenants can only see their own data (for when auth is implemented)
-- CREATE POLICY "Tenants can view their own tenant record" ON tenants
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM users
--             WHERE users.id = auth.uid()::uuid
--             AND users.tenant_id = tenants.id
--         )
--     );

-- CREATE POLICY "Tenants can view their own unit" ON units
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM tenants
--             JOIN users ON users.tenant_id = tenants.id
--             WHERE users.id = auth.uid()::uuid
--             AND tenants.unit_id = units.id
--         )
--     );

-- Note: More RLS policies should be added for meters, readings, and bills
-- This is a basic setup to get started
