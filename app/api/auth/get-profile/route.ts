import { createSupabaseAdminClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    let body: { userId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
    const userId = body?.userId

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const adminClient = createSupabaseAdminClient()
    // maybeSingle() returns null when 0 rows instead of erroring (avoids PGRST116)
    const { data: profile, error: selectError } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (selectError) {
      console.error('Error fetching profile:', selectError)
      return NextResponse.json(
        { error: 'Failed to fetch profile', details: selectError.message },
        { status: 500 }
      )
    }

    if (profile) {
      return NextResponse.json({ profile })
    }

    // Profile missing: create it from auth user so sign-in doesn't rely on client-side RLS
    const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(userId)
    if (authError || !authUser?.user?.email) {
      console.error('Could not load auth user for profile creation:', authError)
      return NextResponse.json(
        { error: 'Profile not found and could not create from auth user.' },
        { status: 404 }
      )
    }

    const email = authUser.user.email
    const name = (authUser.user.user_metadata?.name as string) || ''
    const role =
      email?.includes('@coastmetering.com') || email?.includes('@coastmgmt.')
        ? 'manager'
        : 'tenant'

    const { data: newProfile, error: insertError } = await adminClient
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          email,
          role,
          name,
        },
        { onConflict: 'id' }
      )
      .select()
      .single()

    if (insertError) {
      console.error('Error creating profile:', insertError)
      return NextResponse.json(
        { error: 'Failed to create profile', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ profile: newProfile })
  } catch (error: any) {
    console.error('Error in get-profile API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}
