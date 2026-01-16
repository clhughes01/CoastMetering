import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

/**
 * API endpoint for creating units
 * Uses admin client to bypass RLS policies
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await request.json()

    // Validate required fields
    if (!body.property_id || !body.unit_number) {
      return NextResponse.json(
        { error: 'Missing required fields: property_id, unit_number' },
        { status: 400 }
      )
    }

    // Check if property exists
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id')
      .eq('id', body.property_id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    // Check if unit number already exists for this property
    const { data: existingUnit } = await supabase
      .from('units')
      .select('id')
      .eq('property_id', body.property_id)
      .eq('unit_number', body.unit_number.trim())
      .single()

    if (existingUnit) {
      return NextResponse.json(
        { error: `Unit ${body.unit_number} already exists for this property` },
        { status: 400 }
      )
    }

    // Insert unit
    const { data, error } = await supabase
      .from('units')
      .insert({
        property_id: body.property_id,
        unit_number: body.unit_number.trim(),
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to create unit',
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
    console.error('Error creating unit:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create unit',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
