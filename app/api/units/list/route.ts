import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

/**
 * API endpoint for listing units
 * Uses admin client to bypass RLS policies
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id')

    let query = supabase
      .from('units')
      .select(`
        id,
        unit_number,
        property_id,
        property:properties (
          id,
          address,
          city,
          state
        )
      `)
      .order('unit_number', { ascending: true })

    if (propertyId) {
      query = query.eq('property_id', propertyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to fetch units',
          details: error.message 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error) {
    console.error('Error fetching units:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch units',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
