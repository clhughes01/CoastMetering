import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseClientFromCookies } from '@/lib/supabase/client'

/**
 * API endpoint for creating properties.
 * Admin: must provide manager_id (assign a Property Manager).
 * Property Manager: property is automatically assigned to them.
 */
export async function POST(request: NextRequest) {
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
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.address || !body.city || !body.state || !body.zip_code) {
      return NextResponse.json(
        { error: 'Missing required fields: address, city, state, zip_code' },
        { status: 400 }
      )
    }

    let managerId: string | null = null
    if (role === 'manager') {
      managerId = user.id
    } else {
      // Admin must assign a Property Manager
      const raw = body.manager_id ?? body.managerId
      if (raw === undefined || raw === null || raw === '') {
        return NextResponse.json(
          { error: 'Admin must assign a Property Manager when creating a property' },
          { status: 400 }
        )
      }
      const id = String(raw).trim()
      const { data: manager } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', id)
        .eq('role', 'manager')
        .single()
      if (!manager) {
        return NextResponse.json(
          { error: 'Invalid Property Manager' },
          { status: 400 }
        )
      managerId = id
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
        manager_id: managerId,
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
