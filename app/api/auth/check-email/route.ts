import { createSupabaseAdminClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Use admin client to check if email exists in user_profiles
    const adminClient = createSupabaseAdminClient()
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('email')
      .eq('email', email.toLowerCase().trim())
      .single()

    return NextResponse.json({ exists: !!profile })
  } catch (error: any) {
    // If error is "no rows", email doesn't exist
    if (error.code === 'PGRST116') {
      return NextResponse.json({ exists: false })
    }
    
    console.error('Error checking email:', error)
    return NextResponse.json(
      { error: 'Failed to check email', exists: false },
      { status: 500 }
    )
  }
}
