import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

/**
 * API endpoint for creating tenants
 * Uses admin client to bypass RLS policies
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await request.json()

    // Validate required fields
    if (!body.unit_id || !body.name || !body.move_in_date) {
      return NextResponse.json(
        { error: 'Missing required fields: unit_id, name, move_in_date' },
        { status: 400 }
      )
    }

    // Check if unit exists
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id')
      .eq('id', body.unit_id)
      .single()

    if (unitError || !unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      )
    }

    // If account_number is provided, check if it's unique
    if (body.account_number) {
      const { data: existingAccount } = await supabase
        .from('tenants')
        .select('id')
        .eq('account_number', body.account_number.trim())
        .single()

      if (existingAccount) {
        return NextResponse.json(
          { error: `Account number ${body.account_number} is already in use` },
          { status: 400 }
        )
      }
    }

    // Insert tenant
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        unit_id: body.unit_id,
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        move_in_date: body.move_in_date,
        account_number: body.account_number?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to create tenant',
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
    console.error('Error creating tenant:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create tenant',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
