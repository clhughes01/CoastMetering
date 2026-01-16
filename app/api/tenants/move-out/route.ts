import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

/**
 * API endpoint for marking tenants as moved out
 * This will be useful for automation when tenants switch
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await request.json()

    // Validate required fields
    if (!body.tenant_id || !body.move_out_date) {
      return NextResponse.json(
        { error: 'Missing required fields: tenant_id, move_out_date' },
        { status: 400 }
      )
    }

    // Check if tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, move_out_date')
      .eq('id', body.tenant_id)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      )
    }

    // Update tenant with move-out date
    const { data, error } = await supabase
      .from('tenants')
      .update({
        move_out_date: body.move_out_date,
      })
      .eq('id', body.tenant_id)
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to update tenant',
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
    console.error('Error updating tenant:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update tenant',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
