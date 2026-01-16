# Coast Metering - Submetering Platform

A comprehensive submetering platform for property management companies to track and manage utility usage across multiple properties and units.

## Features

- **Multi-Property Management**: Support for 200+ properties with multiple units
- **Submeter Data Ingestion**: 
  - Badger Orion submeters (JSON format)
  - Chinese submetering devices (CBOR format, decoded to JSON)
- **Admin Dashboard**: Full access to all properties, units, tenants, and utility data
- **Tenant Portal**: Secure access for tenants to view their usage and bills
- **Scalable Architecture**: Built with Next.js 14 and Supabase for high performance

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (to be implemented)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- A Supabase project (create one at [supabase.com](https://supabase.com))

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd CoastMetering
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

   **Create a `.env` file** in the root directory (same level as `package.json`):
   ```bash
   touch .env
   ```

   **Find your Supabase credentials:**
   - Go to [supabase.com](https://supabase.com) and sign in
   - Select your project (or create a new one)
   - Go to **Settings** (gear icon in the left sidebar)
   - Click on **API** in the settings menu
   - You'll see:
     - **Project URL** - This is your `NEXT_PUBLIC_SUPABASE_URL`
     - **anon/public key** - This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role key** - This is your `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

   **Add the credentials to your `.env` file:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   ⚠️ **Important:** The `.env` file is already in `.gitignore`, so it won't be committed to git. Never share your service role key publicly!

4. Set up the database schema:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the SQL from `supabase/schema.sql`

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
CoastMetering/
├── app/                    # Next.js app directory
│   ├── admin/             # Admin dashboard pages
│   ├── tenant/            # Tenant portal pages
│   ├── api/               # API routes
│   │   └── ingest/        # Data ingestion endpoints
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── lib/                   # Utility libraries
│   ├── supabase/          # Supabase client configuration
│   └── utils/             # Helper functions (CBOR decoding, etc.)
├── supabase/              # Database schema
│   └── schema.sql         # SQL schema definition
└── package.json           # Dependencies
```

## API Endpoints

### Data Ingestion

#### Badger Orion Submeters
**POST** `/api/ingest/badger-orion`

Accepts JSON data from Badger Orion submeters. The endpoint expects:
- `meter_number`: Identifier for the meter
- `reading_value`: Numeric reading value
- `reading_date`: Date of the reading (YYYY-MM-DD format)

Example request:
```json
{
  "meter_number": "12345",
  "reading_value": 1250.50,
  "reading_date": "2026-01-15"
}
```

#### Chinese Submetering Devices
**POST** `/api/ingest/chinese-device`

Accepts CBOR-encoded bytes from Chinese submetering devices. The CBOR is automatically decoded to JSON before processing.

## Database Schema

The database includes the following main tables:

- **properties**: Property information (address, owner, utilities)
- **units**: Units within properties
- **tenants**: Tenant information and move-in/out dates
- **meters**: Submeter devices (water, power, gas)
- **meter_readings**: Individual meter readings with raw data
- **utility_bills**: Bill records (for future billing functionality)
- **users**: User accounts for authentication

See `supabase/schema.sql` for the complete schema with relationships and indexes.

## Development Roadmap

### Phase 1: Foundation (Current)
- ✅ Project setup and configuration
- ✅ Database schema design
- ✅ Basic admin and tenant views
- ✅ Data ingestion API endpoints
- ✅ CBOR decoding utilities

### Phase 2: Authentication
- [ ] Supabase Auth integration
- [ ] Admin login/authentication
- [ ] Tenant login/authentication
- [ ] Role-based access control

### Phase 3: Data Management
- [ ] Property/unit/tenant CRUD operations
- [ ] Meter management interface
- [ ] Reading data visualization
- [ ] Data export functionality

### Phase 4: Billing (Future)
- [ ] Bill calculation logic
- [ ] Bill generation
- [ ] Payment processing integration
- [ ] PDF statement generation

## Notes

- Currently, billing functionality is intentionally excluded per project requirements
- The system is designed to scale to 200+ properties
- Data ingestion endpoints are ready but will need adjustment based on actual device output formats
- Authentication is planned but not yet implemented

## License

MIT License - See LICENSE file for details

Copyright (c) 2026 Christopher Hughes
