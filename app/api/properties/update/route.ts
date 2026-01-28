import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

/**
 * API endpoint for updating properties
 * Uses admin client to bypass RLS policies
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await request.json()

    // Validate required fields
    if (!body.property_id) {
      return NextResponse.json(
        { error: 'Missing required field: property_id' },
        { status: 400 }
      )
    }

    // Build update object with only provided fields
    const updateData: any = {}
    if (body.address !== undefined) {
      updateData.address = body.address.trim()
    }
    if (body.city !== undefined) {
      updateData.city = body.city.trim()
    }
    if (body.state !== undefined) {
      updateData.state = body.state.trim().toUpperCase()
    }
    if (body.zip_code !== undefined) {
      updateData.zip_code = body.zip_code.trim()
    }
    if (body.owner_name !== undefined) {
      updateData.owner_name = body.owner_name?.trim() || null
    }
    if (body.water_utility !== undefined) {
      updateData.water_utility = body.water_utility?.trim() || null
    }
    if (body.power_utility !== undefined) {
      updateData.power_utility = body.power_utility?.trim() || null
    }
    if (body.gas_utility !== undefined) {
      updateData.gas_utility = body.gas_utility?.trim() || null
    }
    
    // Ensure we update even if values are empty strings (to clear them)
    if (body.water_utility === '') {
      updateData.water_utility = null
    }
    if (body.power_utility === '') {
      updateData.power_utility = null
    }
    if (body.gas_utility === '') {
      updateData.gas_utility = null
    }

    // Update property
    const { data, error } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', body.property_id)
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to update property',
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
    console.error('Error updating property:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update property',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
