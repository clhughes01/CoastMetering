import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'
import { decodeCBORToJSON, validateMeterReading, normalizeMeterReading } from '@/lib/utils/cbor-decoder'

/**
 * API endpoint for ingesting data from Chinese submetering devices
 * Expects CBOR bytes which will be decoded to JSON
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    
    // Get the raw body as buffer for CBOR decoding
    const arrayBuffer = await request.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Decode CBOR to JSON
    const decodedData = decodeCBORToJSON(buffer)

    // Validate the decoded data
    const validation = validateMeterReading(decodedData)
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid meter reading data',
          details: validation.errors
        },
        { status: 400 }
      )
    }

    // Normalize the data to our standard format
    const normalized = normalizeMeterReading(decodedData, 'chinese_device')

    // Find the meter by meter_number
    const { data: meter, error: meterError } = await supabase
      .from('meters')
      .select('id, unit_id')
      .eq('meter_number', normalized.meter_number)
      .eq('is_active', true)
      .single()

    if (meterError || !meter) {
      return NextResponse.json(
        { error: `Meter not found: ${normalized.meter_number}` },
        { status: 404 }
      )
    }

    // Check if reading already exists for this date
    const { data: existingReading } = await supabase
      .from('meter_readings')
      .select('id')
      .eq('meter_id', meter.id)
      .eq('reading_date', normalized.reading_date)
      .single()

    if (existingReading) {
      // Update existing reading
      const { error: updateError } = await supabase
        .from('meter_readings')
        .update({
          reading_value: normalized.reading_value,
          raw_data: normalized.raw_data,
          source: 'chinese_device'
        })
        .eq('id', existingReading.id)

      if (updateError) {
        throw updateError
      }

      return NextResponse.json({
        success: true,
        message: 'Reading updated',
        reading_id: existingReading.id
      })
    } else {
      // Insert new reading
      const { data: newReading, error: insertError } = await supabase
        .from('meter_readings')
        .insert({
          meter_id: meter.id,
          reading_value: normalized.reading_value,
          reading_date: normalized.reading_date,
          raw_data: normalized.raw_data,
          source: 'chinese_device'
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      return NextResponse.json({
        success: true,
        message: 'Reading created',
        reading_id: newReading.id
      })
    }
  } catch (error) {
    console.error('Error ingesting Chinese device data:', error)
    return NextResponse.json(
      { 
        error: 'Failed to ingest data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
