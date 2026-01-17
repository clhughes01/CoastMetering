# Automation Guide

This guide explains how to automate data entry and updates in the Coast Metering platform. The system is designed with a **database-first approach**, meaning you can update data directly in the database (or via API), and the frontend will automatically reflect those changes in real-time.

## Architecture Philosophy

The platform follows this principle:
- **Database is the source of truth** - All data lives in Supabase
- **Frontend is a read-only view** - The UI displays what's in the database
- **Real-time updates** - Changes to the database automatically appear in the UI
- **Manual forms are optional** - Use them for initial setup, but automation can bypass them

## How Real-Time Updates Work

The frontend uses Supabase's real-time subscriptions to automatically update when:
- Properties are added/updated/deleted
- Units are added/updated/deleted
- Tenants are added/updated/moved out
- Meters are added/updated/deactivated
- Meter readings are added

**No page refresh needed!** Changes appear instantly.

## Ways to Update Data

### 1. Direct Database Updates (Supabase Dashboard)
- Go to your Supabase project dashboard
- Navigate to Table Editor
- Edit data directly in tables
- Changes appear in the frontend immediately

### 2. API Endpoints (For Automation)
All our API endpoints use the service role key, so they work independently of the frontend:

- **Properties**: `POST /api/properties/create`
- **Units**: `POST /api/units/create`
- **Tenants**: `POST /api/tenants/create`
- **Meters**: `POST /api/meters/create`
- **Tenant Move-Out**: `POST /api/tenants/move-out`
- **Meter Readings**: `POST /api/ingest/badger-orion` or `/api/ingest/chinese-device`

### 3. Frontend Forms (Manual Entry)
- Use the "Create Property", "Add Unit", "Add Tenant", "Add Meter" buttons
- Useful for initial setup and manual corrections
- All forms also update the database, triggering real-time updates

## Automation Scenarios

### Scenario 1: New Tenant Moves In

**Option A: Via Database**
```sql
-- Insert new tenant directly in Supabase SQL Editor
INSERT INTO tenants (unit_id, name, email, phone, move_in_date, account_number)
VALUES (
  'unit-uuid-here',
  'John Doe',
  'john@example.com',
  '555-1234',
  '2026-01-15',
  '1006'
);
```

**Option B: Via API (from automation script)**
```javascript
fetch('/api/tenants/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    unit_id: 'unit-uuid-here',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-1234',
    move_in_date: '2026-01-15',
    account_number: '1006'
  })
});
```

**Result**: Frontend automatically shows the new tenant in the property details page.

### Scenario 2: Tenant Moves Out

**Option A: Via Database**
```sql
UPDATE tenants
SET move_out_date = '2026-01-20'
WHERE id = 'tenant-uuid-here';
```

**Option B: Via API**
```javascript
fetch('/api/tenants/move-out', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenant_id: 'tenant-uuid-here',
    move_out_date: '2026-01-20'
  })
});
```

**Result**: Tenant automatically moves from "Current Tenant" to "Past Tenants" section.

### Scenario 3: New Meter Reading from Submeter Device

**Via API (automated from device)**
```javascript
// Badger Orion device sends data
fetch('/api/ingest/badger-orion', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    meter_number: '12345',
    reading_value: 1250.50,
    reading_date: '2026-01-15'
  })
});
```

**Result**: Reading is stored in database, and any views showing meter readings update automatically.

### Scenario 4: Bulk Property Setup

For initial setup with many properties, you can:
1. Use Supabase's CSV import feature
2. Write a script that calls the API endpoints
3. Use SQL INSERT statements

All methods will automatically appear in the frontend.

## Best Practices for Automation

1. **Use API endpoints** for programmatic updates (webhooks, scripts, scheduled jobs)
2. **Use database directly** for bulk operations or one-off corrections
3. **Use frontend forms** only for occasional manual entry
4. **Monitor real-time subscriptions** - they handle UI updates automatically

## Example: Automated Tenant Switching Script

```javascript
// This could run on a schedule or be triggered by an external system
async function switchTenant(unitId, oldTenantId, newTenantData) {
  // Mark old tenant as moved out
  await fetch('/api/tenants/move-out', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: oldTenantId,
      move_out_date: new Date().toISOString().split('T')[0]
    })
  });

  // Add new tenant
  await fetch('/api/tenants/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      unit_id: unitId,
      ...newTenantData
    })
  });

  // Frontend automatically updates - no manual refresh needed!
}
```

## Database Schema Reference

Key tables for automation:
- `properties` - Property information
- `units` - Units within properties
- `tenants` - Tenant information (linked to units)
- `meters` - Submeter devices (linked to units)
- `meter_readings` - Individual readings from meters
- `utility_bills` - Generated bills (for future billing)

## Security Notes

- API endpoints use service role key (bypasses RLS)
- For production, add authentication to API endpoints
- Consider rate limiting for automated requests
- Validate all inputs before database insertion

## Future Automation Ideas

1. **Scheduled Jobs**: Automatically pull meter readings from devices
2. **Webhooks**: Receive notifications from property management systems
3. **CSV Imports**: Bulk import properties/tenants from spreadsheets
4. **Integration APIs**: Connect with other property management software
