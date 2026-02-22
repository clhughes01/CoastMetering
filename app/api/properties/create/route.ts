import { NextRequest, NextResponse } from 'next/server'
import { createPropertyHandler } from '@/lib/api/createPropertyHandler'

export async function POST(request: NextRequest) {
  try {
    return await createPropertyHandler(request)
  } catch (err) {
    console.error('Error creating property:', err)
    return NextResponse.json(
      {
        error: 'Failed to create property',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
