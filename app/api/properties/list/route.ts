import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

/**
 * API endpoint for listing properties
 * Uses admin client to bypass RLS policies
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()

    const { data, error } = await supabase
      .from('properties')
      .select('id, address, city, state, zip_code')
      .order('address', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to fetch properties',
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
    console.error('Error fetching properties:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch properties',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
