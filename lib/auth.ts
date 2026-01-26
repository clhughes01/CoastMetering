// ===========================================
// AUTHENTICATION FUNCTIONS
// Handles Supabase Auth for login, signup, and role management
// ===========================================

import { createSupabaseClient, createSupabaseServerClient } from './supabase/client'
import type { User } from './types'

/**
 * Sign up a new user
 * Automatically determines role based on email domain
 */
export async function signUp(email: string, password: string, name?: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const supabase = createSupabaseClient()
    
    // Determine role based on email domain
    const role = email.includes('@coastmetering.com') || email.includes('@coastmgmt.') 
      ? 'manager' 
      : 'tenant'

    // Sign up with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || '',
          role: role,
        },
      },
    })

    if (error) {
      return { user: null, error: error.message }
    }

    if (!data.user) {
      return { user: null, error: 'Failed to create user' }
    }

    // The profile is automatically created by the database trigger
    // Wait a moment for the trigger to execute, then verify profile exists
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Verify profile was created (trigger should handle this)
    let profile = null
    let retries = 3
    
    while (!profile && retries > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileData) {
        profile = profileData
        break
      }

      // If profile doesn't exist and we got an error, try to create it manually
      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, try to create it
        const { error: insertError } = await supabase
          .from('user_profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email!,
            role: role,
            name: name || '',
          }, {
            onConflict: 'id'
          })

        if (insertError) {
          console.warn('Error creating user profile (may already exist):', insertError)
        } else {
          // Fetch the newly created profile
          const { data: newProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single()
          profile = newProfile
          break
        }
      }

      retries--
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Return user object
    const user: User = {
      id: data.user.id,
      email: data.user.email!,
      role: role as 'manager' | 'tenant',
      name: name || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(role === 'manager' ? { companyName: 'Coast Mgmt.' } : {}),
    }

    return { user, error: null }
  } catch (error: any) {
    console.error('Signup error:', error)
    return { user: null, error: error.message || 'An error occurred during signup' }
  }
}

/**
 * Sign in an existing user
 */
export async function signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const supabase = createSupabaseClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { user: null, error: error.message }
    }

    if (!data.user) {
      return { user: null, error: 'Invalid credentials' }
    }

    // Get user profile to determine role - CRITICAL: Must fetch from database
    // Use API route with admin client to bypass RLS and get the actual role
    let profile = null
    
    try {
      // Call API route to fetch profile (uses admin client server-side)
      const response = await fetch('/api/auth/get-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: data.user.id }),
      })

      if (response.ok) {
        const { profile: profileData } = await response.json()
        profile = profileData
      } else {
        // Profile doesn't exist, create it with default role
        const role = email.includes('@coastmetering.com') || email.includes('@coastmgmt.') 
          ? 'manager' 
          : 'tenant'

        // Create profile using regular client (RLS allows public insert)
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email!,
            role: role,
            name: data.user.user_metadata?.name || '',
          }, {
            onConflict: 'id'
          })
          .select()
          .single()

        if (newProfile) {
          profile = newProfile
        } else if (insertError) {
          console.error('Failed to create profile:', insertError)
          // Fallback to email-based role
          const fallbackRole = email.includes('@coastmetering.com') || email.includes('@coastmgmt.') 
            ? 'manager' 
            : 'tenant'
          
          const fallbackUser: User = {
            id: data.user.id,
            email: data.user.email!,
            role: fallbackRole as 'manager' | 'tenant',
            name: data.user.user_metadata?.name || '',
            createdAt: new Date(data.user.created_at),
            updatedAt: new Date(),
          }
          
          return { user: fallbackUser, error: null }
        }
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error)
      // Fallback to email-based role
      const fallbackRole = email.includes('@coastmetering.com') || email.includes('@coastmgmt.') 
        ? 'manager' 
        : 'tenant'
      
      const fallbackUser: User = {
        id: data.user.id,
        email: data.user.email!,
        role: fallbackRole as 'manager' | 'tenant',
        name: data.user.user_metadata?.name || '',
        createdAt: new Date(data.user.created_at),
        updatedAt: new Date(),
      }
      
      return { user: fallbackUser, error: null }
    }

    if (!profile) {
      // This shouldn't happen, but just in case
      const fallbackRole = email.includes('@coastmetering.com') || email.includes('@coastmgmt.') 
        ? 'manager' 
        : 'tenant'
      
      const fallbackUser: User = {
        id: data.user.id,
        email: data.user.email!,
        role: fallbackRole as 'manager' | 'tenant',
        name: data.user.user_metadata?.name || '',
        createdAt: new Date(data.user.created_at),
        updatedAt: new Date(),
      }
      
      console.warn('Profile is null, using fallback')
      return { user: fallbackUser, error: null }
    }

    // Return user with profile data
    const user: User = {
      id: profile.id,
      email: profile.email,
      role: profile.role as 'manager' | 'tenant',
      name: profile.name || '',
      phone: profile.phone,
      createdAt: new Date(profile.created_at),
      updatedAt: new Date(profile.updated_at),
      ...(profile.role === 'manager' ? { companyName: profile.company_name } : { accountNumber: profile.account_number }),
    }

    return { user, error: null }
  } catch (error: any) {
    console.error('Sign in error:', error)
    return { user: null, error: error.message || 'An error occurred during sign in' }
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: string | null }> {
  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.auth.signOut()
    return { error: error?.message || null }
  } catch (error: any) {
    return { error: error.message || 'An error occurred during sign out' }
  }
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = createSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // Use API route to fetch profile (bypasses RLS using admin client)
    try {
      const response = await fetch('/api/auth/get-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      })

      if (response.ok) {
        const { profile } = await response.json()
        
        if (profile) {
          console.log('Profile fetched successfully:', { 
            id: profile.id, 
            email: profile.email, 
            name: profile.name,
            role: profile.role 
          })
          return {
            id: profile.id,
            email: profile.email,
            role: profile.role as 'manager' | 'tenant',
            name: profile.name || '',
            phone: profile.phone,
            createdAt: new Date(profile.created_at),
            updatedAt: new Date(profile.updated_at),
            ...(profile.role === 'manager' ? { companyName: profile.company_name } : { accountNumber: profile.account_number }),
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('API route returned error:', response.status, errorData)
      }
    } catch (apiError) {
      console.error('Error fetching profile via API:', apiError)
    }

    // Fallback: try to get profile directly (might fail due to RLS)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profile) {
      return {
        id: profile.id,
        email: profile.email,
        role: profile.role as 'manager' | 'tenant',
        name: profile.name || '',
        phone: profile.phone,
        createdAt: new Date(profile.created_at),
        updatedAt: new Date(profile.updated_at),
        ...(profile.role === 'manager' ? { companyName: profile.company_name } : { accountNumber: profile.account_number }),
      }
    }

    // Last resort: return user with minimal info
    return {
      id: user.id,
      email: user.email!,
      role: 'tenant' as const, // Default to tenant if we can't determine
      name: user.user_metadata?.name || '',
      createdAt: new Date(user.created_at),
      updatedAt: new Date(),
    }
  } catch (error) {
    console.error('Get current user error:', error)
    return null
  }
}
