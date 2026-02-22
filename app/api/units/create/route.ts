import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseClientFromCookies } from '@/lib/supabase/client'

/**
 * API endpoint for creating units.
 * Manager: can only create units on their properties or unassigned properties.
 */
export async function POST(request: NextRequest) {
  const run = async () => {
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

    if (!body.property_id || !body.unit_number) {
      return NextResponse.json(
        { error: 'Missing required fields: property_id, unit_number' },
        { status: 400 }
      )
    }

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, manager_id')
      .eq('id', body.property_id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }
    if (role === 'manager' && property.manager_id != null && property.manager_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only add units to your own properties or unassigned properties' },
        { status: 403 }
      )
    }

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
        { error: 'Failed to create unit', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  }

  const caught = (err: unknown) => {
    console.error('Error creating unit:', err)
    return NextResponse.json(
      {
        error: 'Failed to create unit',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }

  return run().catch(caught)
}
