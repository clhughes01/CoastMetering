import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseClientFromCookies } from '@/lib/supabase/client'

/**
 * API endpoint for listing properties.
 * Admin: all properties. Property Manager: only their properties and unassigned.
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createSupabaseClientFromCookies()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createSupabaseAdminClient()
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role

    let query = supabase
      .from('properties')
      .select('id, address, city, state, zip_code')
      .order('address', { ascending: true })

    if (role === 'manager') {
      query = query.or(`manager_id.eq.${user.id},manager_id.is.null`)
    }
    // admin or other: no filter (admin sees all; unauthenticated already 401)

    const { data, error } = await query

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
