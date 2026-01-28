import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

/**
 * API endpoint for updating tenants (e.g., move-out date)
 * Uses admin client to bypass RLS policies
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await request.json()

    // Validate required fields
    if (!body.tenant_id) {
      return NextResponse.json(
        { error: 'Missing required field: tenant_id' },
        { status: 400 }
      )
    }

    // Build update object with only provided fields
    const updateData: any = {}
    if (body.move_out_date !== undefined) {
      updateData.move_out_date = body.move_out_date || null
    }
    if (body.name !== undefined) {
      updateData.name = body.name.trim()
    }
    if (body.email !== undefined) {
      updateData.email = body.email?.trim() || null
    }
    if (body.phone !== undefined) {
      updateData.phone = body.phone?.trim() || null
    }
    if (body.account_number !== undefined) {
      updateData.account_number = body.account_number?.trim() || null
    }

    // Update tenant
    const { data, error } = await supabase
      .from('tenants')
      .update(updateData)
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
