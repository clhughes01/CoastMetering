/**
 * Shared TypeScript types and interfaces
 * Centralized type definitions for the application
 */

export type UserRole = 'admin' | 'tenant'

export type MeterType = 'water' | 'power' | 'gas'

export type DeviceType = 'badger_orion' | 'chinese_device'

export type ReadingSource = 'badger_orion' | 'chinese_device' | 'manual'

export interface Property {
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

export interface Unit {
  id: string
  property_id: string
  unit_number: string
  created_at: string
  updated_at: string
}

export interface Tenant {
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

export interface Meter {
  id: string
  unit_id: string
  meter_number: string
  meter_type: MeterType
  device_type: DeviceType | null
  device_identifier: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MeterReading {
  id: string
  meter_id: string
  reading_value: number
  reading_date: string
  raw_data: any | null
  source: ReadingSource | null
  created_at: string
  updated_at: string
}

export interface UtilityBill {
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
