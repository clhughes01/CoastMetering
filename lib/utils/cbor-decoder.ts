import * as cbor from 'cbor'

/**
 * Decodes CBOR bytes to JSON format
 * Used for Chinese submetering devices that output CBOR format
 */
export function decodeCBORToJSON(cborBytes: Buffer | Uint8Array | string): any {
  try {
    // If input is a string, try to parse it as hex or base64
    if (typeof cborBytes === 'string') {
      // Try hex first
      if (/^[0-9a-fA-F]+$/.test(cborBytes)) {
        cborBytes = Buffer.from(cborBytes, 'hex')
      } else {
        // Try base64
        cborBytes = Buffer.from(cborBytes, 'base64')
      }
    }

    // Decode CBOR
    const decoded = cbor.decode(cborBytes)
    
    // Convert to JSON-serializable format
    return JSON.parse(JSON.stringify(decoded))
  } catch (error) {
    throw new Error(`Failed to decode CBOR: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Validates that decoded CBOR contains expected meter reading fields
 */
export function validateMeterReading(data: any): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!data.meter_number && !data.meterId && !data.device_id) {
    errors.push('Missing meter identifier')
  }

  if (typeof data.reading_value !== 'number' && typeof data.value !== 'number' && typeof data.reading !== 'number') {
    errors.push('Missing or invalid reading value')
  }

  if (!data.reading_date && !data.date && !data.timestamp) {
    errors.push('Missing reading date/timestamp')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Normalizes meter reading data from different device formats to our standard format
 */
export function normalizeMeterReading(data: any, source: 'badger_orion' | 'chinese_device'): {
  meter_number: string
  reading_value: number
  reading_date: string
  raw_data: any
} {
  let meter_number: string
  let reading_value: number
  let reading_date: string

  if (source === 'badger_orion') {
    // Badger Orion format (adjust based on actual API documentation)
    meter_number = data.meter_number || data.meterId || data.device_id || ''
    reading_value = data.reading_value || data.value || data.reading || 0
    reading_date = data.reading_date || data.date || data.timestamp || new Date().toISOString().split('T')[0]
  } else {
    // Chinese device format (adjust based on actual device output)
    meter_number = data.meter_number || data.meterId || data.device_id || ''
    reading_value = data.reading_value || data.value || data.reading || 0
    reading_date = data.reading_date || data.date || data.timestamp || new Date().toISOString().split('T')[0]
  }

  return {
    meter_number,
    reading_value,
    reading_date,
    raw_data: data
  }
}
