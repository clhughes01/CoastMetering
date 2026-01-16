export type Database = {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string
          address: string
          city: string
          state: string
          zip_code: string
          owner_name: string | null
          water_utility: string | null
          power_utility: string | null
          gas_utility: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['properties']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['properties']['Insert']>
      }
      units: {
        Row: {
          id: string
          property_id: string
          unit_number: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['units']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['units']['Insert']>
      }
      tenants: {
        Row: {
          id: string
          unit_id: string
          name: string
          email: string | null
          phone: string | null
          move_in_date: string
          move_out_date: string | null
          account_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }
      meters: {
        Row: {
          id: string
          unit_id: string
          meter_number: string
          meter_type: 'water' | 'power' | 'gas'
          device_type: 'badger_orion' | 'chinese_device' | null
          device_identifier: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['meters']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['meters']['Insert']>
      }
      meter_readings: {
        Row: {
          id: string
          meter_id: string
          reading_value: number
          reading_date: string
          raw_data: any | null
          source: 'badger_orion' | 'chinese_device' | 'manual' | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['meter_readings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['meter_readings']['Insert']>
      }
      utility_bills: {
        Row: {
          id: string
          unit_id: string
          tenant_id: string | null
          month: number
          year: number
          bill_date: string
          water_reading_id: string | null
          power_reading_id: string | null
          gas_reading_id: string | null
          total_amount: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['utility_bills']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['utility_bills']['Insert']>
      }
      users: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'tenant'
          tenant_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
    }
  }
}
