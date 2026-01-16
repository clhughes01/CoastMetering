import { useState, useEffect } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Property } from '@/lib/types'

export const useProperties = () => {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createSupabaseClient()

  const loadProperties = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error: fetchError } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setProperties(data || [])
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load properties')
      setError(error)
      console.error('Error loading properties:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProperties()
  }, [])

  return {
    properties,
    loading,
    error,
    refetch: loadProperties,
  }
}
