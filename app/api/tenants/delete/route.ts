import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

/**
 * DELETE a tenant from the database.
 * Used when "changing tenant" so the old tenant is fully removed.
 * Related rows (e.g. utility_bills.tenant_id, users.tenant_id) use ON DELETE SET NULL.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await request.json()

    if (!body.tenant_id) {
      return NextResponse.json(
        { error: 'Missing required field: tenant_id' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', body.tenant_id)

    if (error) {
      console.error('Supabase delete tenant error:', error)
      return NextResponse.json(
        { error: 'Failed to delete tenant', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tenant:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete tenant',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
