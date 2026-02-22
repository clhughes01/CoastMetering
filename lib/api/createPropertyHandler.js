import { NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseClientFromCookies } from '@/lib/supabase/client'

export async function createPropertyHandler(request) {
  const supabaseAuth = await createSupabaseClientFromCookies()
  const authResult = await supabaseAuth.auth.getUser()
  const user = authResult.data?.user
  const authError = authResult.error
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createSupabaseAdminClient()
  const profileRes = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  const role = profileRes.data?.role
  if (role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  if (!body.address || !body.city || !body.state || !body.zip_code) {
    return NextResponse.json(
      { error: 'Missing required fields: address, city, state, zip_code' },
      { status: 400 }
    )
  }

  let managerId = null
  let landlordId = null

  if (role === 'manager') {
    managerId = user.id
    const rawLandlord = body.landlord_id ?? body.landlordId
    if (rawLandlord === undefined || rawLandlord === null || rawLandlord === '') {
      return NextResponse.json(
        { error: 'Property Managers must assign a Landlord when creating a property' },
        { status: 400 }
      )
    }
    const lid = String(rawLandlord).trim()
    const landlordRes = await supabase.from('user_profiles').select('id').eq('id', lid).eq('role', 'landlord').single()
    if (!landlordRes.data) {
      return NextResponse.json(
        { error: 'Invalid Landlord' },
        { status: 400 }
      )
    }
    landlordId = lid
  }
  if (role !== 'manager') {
    const raw = body.manager_id ?? body.managerId
    if (raw === undefined || raw === null || raw === '') {
      return NextResponse.json(
        { error: 'Admin must assign a Property Manager when creating a property' },
        { status: 400 }
      )
    }
    const id = String(raw).trim()
    const managerRes = await supabase.from('user_profiles').select('id').eq('id', id).eq('role', 'manager').single()
    if (!managerRes.data) {
      return NextResponse.json(
        { error: 'Invalid Property Manager' },
        { status: 400 }
      )
    }
    managerId = id
  }

  const payload = {}
  payload.address = body.address.trim()
  payload.city = body.city.trim()
  payload.state = body.state.trim().toUpperCase()
  payload.zip_code = body.zip_code.trim()
  payload.owner_name = body.owner_name?.trim() || null
  payload.water_utility = body.water_utility?.trim() || null
  payload.power_utility = body.power_utility?.trim() || null
  payload.gas_utility = body.gas_utility?.trim() || null
  payload.manager_id = managerId
  payload.landlord_id = landlordId ?? body.landlord_id ?? body.landlordId ?? null
  const result = await supabase.from('properties').insert(payload).select().single()
  if (result.error) {
    console.error('Supabase error:', result.error)
    return NextResponse.json(
      { error: 'Failed to create property', details: result.error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ success: true, data: result.data })
}
