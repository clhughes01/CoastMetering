import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

/**
 * API endpoint for creating properties
 * Uses admin client to bypass RLS policies
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await request.json()

    // Validate required fields
    if (!body.address || !body.city || !body.state || !body.zip_code) {
      return NextResponse.json(
        { error: 'Missing required fields: address, city, state, zip_code' },
        { status: 400 }
      )
    }

    // Insert property
    const { data, error } = await supabase
      .from('properties')
      .insert({
        address: body.address.trim(),
        city: body.city.trim(),
        state: body.state.trim().toUpperCase(),
        zip_code: body.zip_code.trim(),
        owner_name: body.owner_name?.trim() || null,
        water_utility: body.water_utility?.trim() || null,
        power_utility: body.power_utility?.trim() || null,
        gas_utility: body.gas_utility?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to create property',
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
    console.error('Error creating property:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create property',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
