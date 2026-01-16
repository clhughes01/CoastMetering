import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

/**
 * API endpoint for creating meters
 * Uses admin client to bypass RLS policies
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await request.json()

    // Validate required fields
    if (!body.unit_id || !body.meter_number || !body.meter_type) {
      return NextResponse.json(
        { error: 'Missing required fields: unit_id, meter_number, meter_type' },
        { status: 400 }
      )
    }

    // Validate meter_type
    if (!['water', 'power', 'gas'].includes(body.meter_type)) {
      return NextResponse.json(
        { error: 'Invalid meter_type. Must be water, power, or gas' },
        { status: 400 }
      )
    }

    // Check if unit exists
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id')
      .eq('id', body.unit_id)
      .single()

    if (unitError || !unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      )
    }

    // Check if meter type already exists for this unit (enforced by UNIQUE constraint)
    const { data: existingMeter } = await supabase
      .from('meters')
      .select('id, meter_type')
      .eq('unit_id', body.unit_id)
      .eq('meter_type', body.meter_type)
      .single()

    if (existingMeter) {
      return NextResponse.json(
        { error: `A ${body.meter_type} meter already exists for this unit` },
        { status: 400 }
      )
    }

    // Insert meter
    const { data, error } = await supabase
      .from('meters')
      .insert({
        unit_id: body.unit_id,
        meter_number: body.meter_number.trim(),
        meter_type: body.meter_type,
        device_type: body.device_type || null,
        device_identifier: body.device_identifier?.trim() || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to create meter',
          details: error.message 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Error creating meter:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create meter',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
