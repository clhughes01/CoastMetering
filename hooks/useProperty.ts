import { useState, useEffect } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Property, Unit } from '@/lib/types'

interface PropertyWithUnits extends Property {
  units: (Unit & {
    tenants: any[]
    meters: any[]
  })[]
}

export const useProperty = (propertyId: string | null) => {
  const [property, setProperty] = useState<PropertyWithUnits | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createSupabaseClient()

  const loadProperty = async () => {
    if (!propertyId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Load property
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single()

      if (propertyError) throw propertyError

      // Load units with related data
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select(`
          *,
          tenants (
            id,
            name,
            move_in_date,
            move_out_date,
            account_number
          ),
          meters (
            id,
            meter_number,
            meter_type,
            device_type,
            is_active
          )
        `)
        .eq('property_id', propertyId)
        .order('unit_number', { ascending: true })

      if (unitsError) throw unitsError

      setProperty({
        ...propertyData,
        units: unitsData || [],
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load property')
      setError(error)
      console.error('Error loading property:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProperty()

    if (!propertyId) return

    // Subscribe to real-time changes for this property and related data
    const channel = supabase
      .channel(`property-${propertyId}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
          filter: `id=eq.${propertyId}`,
        },
        () => {
          console.log('Property changed, reloading...')
          loadProperty()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'units',
          filter: `property_id=eq.${propertyId}`,
        },
        () => {
          console.log('Units changed, reloading...')
          loadProperty()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants',
        },
        () => {
          console.log('Tenants changed, reloading...')
          loadProperty()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meters',
        },
        () => {
          console.log('Meters changed, reloading...')
          loadProperty()
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [propertyId])

  return {
    property,
    loading,
    error,
    refetch: loadProperty,
  }
}
