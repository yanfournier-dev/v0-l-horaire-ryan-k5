import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Revalidate the calendar page
    revalidatePath('/dashboard/calendar', 'page')
    
    // Also revalidate the layout in case there's cached data there
    revalidatePath('/dashboard', 'layout')
    
    return NextResponse.json({ 
      revalidated: true, 
      now: Date.now() 
    })
  } catch (err) {
    return NextResponse.json({ 
      revalidated: false, 
      error: 'Error revalidating' 
    }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}
