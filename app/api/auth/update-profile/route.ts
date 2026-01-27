import { createSupabaseAdminClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, phone, companyName } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Use admin client to update profile
    const adminClient = createSupabaseAdminClient()
    
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (companyName !== undefined) updateData.company_name = companyName

    const { data: profile, error } = await adminClient
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      return NextResponse.json(
        { error: 'Failed to update profile', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ profile })
  } catch (error: any) {
    console.error('Error in update-profile API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
