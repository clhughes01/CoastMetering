// ===========================================
// MOCK DATA - REPLACE WITH DATABASE QUERIES
// ===========================================
// This file contains mock data for development.
// 
// TO CONNECT TO A REAL DATABASE:
// 1. Install your database client (e.g., @vercel/postgres, prisma, drizzle)
// 2. Create functions that query your database
// 3. Replace the exports below with your database functions
//
// Example with Prisma:
// export async function getCustomers() {
//   return await prisma.customer.findMany()
// }
//
// Example with raw SQL:
// export async function getCustomers() {
//   const { rows } = await sql`SELECT * FROM customers`
//   return rows as Customer[]
// }
// ===========================================

import type { Customer, Statement, Payment, UtilityBill, ConsumptionData, User } from "./types"

// ===========================================
// MOCK USERS - Replace with auth system
// ===========================================
export const mockUsers: User[] = [
  {
    id: "1",
    email: "manager@coastmetering.com",
    role: "manager",
    name: "Coast Management",
    companyName: "Coast Mgmt.",
    phone: "8589001067",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    email: "rosalia.m@email.com",
    role: "tenant",
    name: "Rosalia Martinez",
    accountNumber: "1005",
    phone: "7608778000",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "3",
    email: "miguel.g@email.com",
    role: "tenant",
    name: "Miguel Gonzales Rubio",
    accountNumber: "1006",
    phone: "7608778000",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// ===========================================
// CUSTOMERS DATA
// ===========================================
export const customers: Customer[] = [
  { id: 1, accountNumber: "1005", residentName: "Rosalia Martinez", unit: "Unit 214", streetAddress: "214 South Beech Street", city: "Escondido, CA", zipCode: "92025", email: "rosalia.m@email.com", phone: "7608778000", landlordName: "Coast Mgmt." },
  { id: 2, accountNumber: "1006", residentName: "Miguel Gonzales Rubio", unit: "Unit 220", streetAddress: "214 South Beech Street", city: "Escondido, CA", zipCode: "92025", email: "miguel.g@email.com", phone: "7608778000", landlordName: "Coast Mgmt." },
  { id: 3, accountNumber: "1007", residentName: "Adolfo Fernandez Hernandez", unit: "Unit 1160", streetAddress: "1160 East Grand Avenue", city: "Escondido, CA", zipCode: "92025", email: "adolfo.f@email.com", phone: "7608778000", landlordName: "Coast Mgmt." },
  { id: 4, accountNumber: "1008", residentName: "Jesus Ramirez", unit: "Unit 1162", streetAddress: "1160 East Grand Avenue", city: "Escondido, CA", zipCode: "92025", email: "jesus.r@email.com", phone: "7608778000", landlordName: "Coast Mgmt." },
  { id: 5, accountNumber: "1009", residentName: "Alejandro Juan Domingo", unit: "Unit 1130", streetAddress: "1128 Grand Avenue", city: "Escondido, CA", zipCode: "92025", email: "alejandro.d@email.com", phone: "7608778000", landlordName: "Coast Mgmt." },
  { id: 6, accountNumber: "1010", residentName: "Roselene Bathol", unit: "Unit 6836", streetAddress: "6836 Amherst Street", city: "San Diego, CA", zipCode: "92115", email: "roselene.b@email.com", phone: "6194963388", landlordName: "Coast Mgmt." },
  { id: 7, accountNumber: "1011", residentName: "Maria Santos", unit: "Unit 302", streetAddress: "302 Palm Drive", city: "Oceanside, CA", zipCode: "92054", email: "maria.s@email.com", phone: "7601234567", landlordName: "Coast Mgmt." },
  { id: 8, accountNumber: "1012", residentName: "Carlos Rodriguez", unit: "Unit 405", streetAddress: "405 Coastal Way", city: "Carlsbad, CA", zipCode: "92008", email: "carlos.r@email.com", phone: "7609876543", landlordName: "Coast Mgmt." },
]

// ===========================================
// STATEMENTS DATA
// ===========================================
export const statements: Statement[] = [
  { id: 1, accountNumber: "1005", residentName: "Rosalia Martinez", unit: "214", streetAddress: "214 South Beech Street", city: "Escondido, CA", startDate: "01-01-2025", endDate: "01-31-2025", amountDue: "$92.09", changeLastMonth: "N/A", amountPaid: "N/A", dueDate: "02-20-2025", landlordName: "Coast Mgmt.", status: "pending" },
  { id: 2, accountNumber: "1006", residentName: "Miguel Gonzales Rubio", unit: "220", streetAddress: "214 South Beech Street", city: "Escondido, CA", startDate: "01-01-2025", endDate: "01-31-2025", amountDue: "$134.80", changeLastMonth: "N/A", amountPaid: "N/A", dueDate: "02-20-2025", landlordName: "Coast Mgmt.", status: "pending" },
  { id: 3, accountNumber: "1007", residentName: "German Lopez Ramirez", unit: "1160", streetAddress: "1160 East Grand Avenue", city: "Escondido, CA", startDate: "01-01-2025", endDate: "01-31-2025", amountDue: "$285.56", changeLastMonth: "N/A", amountPaid: "N/A", dueDate: "02-20-2025", landlordName: "Coast Mgmt.", status: "pending" },
  { id: 4, accountNumber: "1008", residentName: "Jesus Ramirez", unit: "1162", streetAddress: "1160 East Grand Avenue", city: "Escondido, CA", startDate: "01-01-2025", endDate: "01-31-2025", amountDue: "$113.35", changeLastMonth: "N/A", amountPaid: "$113.35", dueDate: "02-20-2025", landlordName: "Coast Mgmt.", status: "paid" },
  { id: 5, accountNumber: "1009", residentName: "Alejandro Juan Domingo", unit: "1130", streetAddress: "1128 Grand Avenue", city: "Escondido, CA", startDate: "01-01-2025", endDate: "01-31-2025", amountDue: "$178.43", changeLastMonth: "+$12.50", amountPaid: "$178.43", dueDate: "02-20-2025", landlordName: "Coast Mgmt.", status: "paid" },
  { id: 6, accountNumber: "1010", residentName: "Roselene Bathol", unit: "6836", streetAddress: "6836 Amherst Street", city: "San Diego, CA", startDate: "01-01-2025", endDate: "01-31-2025", amountDue: "$67.22", changeLastMonth: "-$5.30", amountPaid: "N/A", dueDate: "02-20-2025", landlordName: "Coast Mgmt.", status: "overdue" },
]

// ===========================================
// PAYMENTS DATA
// ===========================================
export const payments: Payment[] = [
  { id: 1, accountNumber: "1038", residentName: "Marcos Diego Nicolas", dateBilled: "01-26-2026", totalAmount: "$5.00", landlordName: "Coast Mgmt.", status: "PENDING" },
  { id: 2, accountNumber: "1037", residentName: "Mario Domingo", dateBilled: "01-26-2026", totalAmount: "$194.50", landlordName: "Coast Mgmt.", status: "requires_payment_method" },
  { id: 3, accountNumber: "1038", residentName: "Marcos Diego Nicolas", dateBilled: "01-26-2026", totalAmount: "$6.02", landlordName: "Coast Mgmt.", status: "succeeded" },
  { id: 4, accountNumber: "1038", residentName: "Marcos Diego Nicolas", dateBilled: "01-26-2026", totalAmount: "$5.54", landlordName: "Coast Mgmt.", status: "succeeded" },
  { id: 5, accountNumber: "1025", residentName: "Sonia Maribel Mendoza", dateBilled: "01-26-2026", totalAmount: "$47.58", landlordName: "Coast Mgmt.", status: "succeeded" },
  { id: 6, accountNumber: "1037", residentName: "Mario Domingo", dateBilled: "01-26-2026", totalAmount: "$120.54", landlordName: "Coast Mgmt.", status: "requires_payment_method" },
  { id: 7, accountNumber: "1037", residentName: "Mario Domingo", dateBilled: "01-26-2026", totalAmount: "$1.93", landlordName: "Coast Mgmt.", status: "requires_payment_method" },
]

// ===========================================
// UTILITY BILLS DATA
// ===========================================
export const utilityBills: UtilityBill[] = [
  { id: 1, month: "March", year: 2024, billDate: "04-02-2024", totalAmount: "$6,391.86", numberOfUnits: 58, landlord: "Coast Mgmt." },
  { id: 2, month: "April", year: 2024, billDate: "05-01-2024", totalAmount: "$6,243.38", numberOfUnits: 57, landlord: "Coast Mgmt." },
  { id: 3, month: "May", year: 2024, billDate: "06-05-2024", totalAmount: "$6,680.82", numberOfUnits: 64, landlord: "Coast Mgmt." },
  { id: 4, month: "June", year: 2024, billDate: "07-09-2024", totalAmount: "$7,400.30", numberOfUnits: 63, landlord: "Coast Mgmt." },
  { id: 5, month: "July", year: 2024, billDate: "08-03-2024", totalAmount: "$9,333.34", numberOfUnits: 65, landlord: "Coast Mgmt." },
  { id: 6, month: "August", year: 2024, billDate: "09-02-2024", totalAmount: "$9,574.13", numberOfUnits: 70, landlord: "Coast Mgmt." },
  { id: 7, month: "September", year: 2024, billDate: "10-01-2024", totalAmount: "$9,666.90", numberOfUnits: 73, landlord: "Coast Mgmt." },
  { id: 8, month: "October", year: 2024, billDate: "10-31-2024", totalAmount: "$8,889.63", numberOfUnits: 74, landlord: "Coast Mgmt." },
  { id: 9, month: "November", year: 2024, billDate: "12-02-2024", totalAmount: "$7,826.22", numberOfUnits: 75, landlord: "Coast Mgmt." },
  { id: 10, month: "December", year: 2024, billDate: "01-03-2025", totalAmount: "$8,561.29", numberOfUnits: 72, landlord: "Coast Mgmt." },
]

// ===========================================
// CONSUMPTION DATA (for charts)
// ===========================================
export const consumptionData: ConsumptionData[] = [
  { month: "Jan", consumption: 4200 },
  { month: "Feb", consumption: 3800 },
  { month: "Mar", consumption: 4100 },
  { month: "Apr", consumption: 4500 },
  { month: "May", consumption: 5200 },
  { month: "Jun", consumption: 6100 },
  { month: "Jul", consumption: 7200 },
  { month: "Aug", consumption: 7500 },
  { month: "Sep", consumption: 6800 },
  { month: "Oct", consumption: 5400 },
  { month: "Nov", consumption: 4600 },
  { month: "Dec", consumption: 4300 },
]

// ===========================================
// DATA ACCESS FUNCTIONS
// These connect to Supabase database
// ===========================================

import { createSupabaseServerClient } from '@/lib/supabase/client'

export async function getCustomers(): Promise<Customer[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('tenants')
      .select(`
        *,
        unit:units (
          unit_number,
          property:properties (
            address,
            city,
            state,
            zip_code,
            owner_name
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching customers:', error)
      return customers
    }

    return (data || []).map((tenant: any, index: number) => ({
      id: index + 1,
      accountNumber: tenant.account_number || `100${index + 1}`,
      residentName: tenant.name,
      unit: `Unit ${tenant.unit?.unit_number || 'N/A'}`,
      streetAddress: tenant.unit?.property?.address || 'N/A',
      city: tenant.unit?.property?.city 
        ? `${tenant.unit.property.city}, ${tenant.unit.property.state}`
        : 'N/A',
      zipCode: tenant.unit?.property?.zip_code || 'N/A',
      email: tenant.email || '',
      phone: tenant.phone || '',
      landlordName: tenant.unit?.property?.owner_name || 'N/A',
      propertyId: tenant.unit?.property?.id,
      userId: tenant.id,
    }))
  } catch (error) {
    console.error('Error in getCustomers:', error)
    return customers
  }
}

export async function getCustomerById(id: number): Promise<Customer | undefined> {
  // TODO: Replace with database query
  return customers.find(c => c.id === id)
}

export async function getCustomerByAccountNumber(accountNumber: string): Promise<Customer | undefined> {
  // TODO: Replace with database query
  return customers.find(c => c.accountNumber === accountNumber)
}

export async function getStatements(): Promise<Statement[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('utility_bills')
      .select(`
        *,
        unit:units (
          unit_number,
          property:properties (
            address,
            city,
            state,
            owner_name
          )
        ),
        tenant:tenants (
          name,
          account_number
        )
      `)
      .order('bill_date', { ascending: false })

    if (error) {
      console.error('Error fetching statements:', error)
      return statements
    }

    return (data || []).map((bill: any, index: number) => {
      const amount = bill.total_amount || 0
      const startDate = bill.bill_date 
        ? new Date(bill.bill_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        : 'N/A'
      const endDate = startDate
      const dueDate = bill.bill_date
        ? new Date(new Date(bill.bill_date).setDate(new Date(bill.bill_date).getDate() + 20)).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        : 'N/A'

      return {
        id: index + 1,
        accountNumber: bill.tenant?.account_number || 'N/A',
        residentName: bill.tenant?.name || 'N/A',
        unit: bill.unit?.unit_number || 'N/A',
        streetAddress: bill.unit?.property?.address || 'N/A',
        city: bill.unit?.property?.city 
          ? `${bill.unit.property.city}, ${bill.unit.property.state}`
          : 'N/A',
        startDate,
        endDate,
        amountDue: `$${amount.toFixed(2)}`,
        changeLastMonth: 'N/A',
        amountPaid: 'N/A',
        dueDate,
        landlordName: bill.unit?.property?.owner_name || 'N/A',
        status: 'pending' as const,
        customerId: bill.tenant?.id ? parseInt(bill.tenant.id.slice(0, 8), 16) : undefined,
      }
    })
  } catch (error) {
    console.error('Error in getStatements:', error)
    return statements
  }
}

export async function getStatementsByCustomer(accountNumber: string): Promise<Statement[]> {
  // TODO: Replace with database query
  return statements.filter(s => s.accountNumber === accountNumber)
}

export async function getPayments(): Promise<Payment[]> {
  // TODO: Replace with database query
  return payments
}

export async function getPaymentsByCustomer(accountNumber: string): Promise<Payment[]> {
  // TODO: Replace with database query
  return payments.filter(p => p.accountNumber === accountNumber)
}

export async function getUtilityBills(): Promise<UtilityBill[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from('utility_bills')
      .select(`
        *,
        unit:units (
          property:properties (
            owner_name
          )
        )
      `)
      .order('bill_date', { ascending: false })

    if (error) {
      console.error('Error fetching utility bills:', error)
      return utilityBills
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December']
    const grouped = (data || []).reduce((acc: any, bill: any) => {
      const key = `${bill.year}-${bill.month}`
      if (!acc[key]) {
        acc[key] = {
          id: Object.keys(acc).length + 1,
          month: monthNames[bill.month - 1],
          year: bill.year,
          billDate: bill.bill_date 
            ? new Date(bill.bill_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
            : 'N/A',
          totalAmount: 0,
          numberOfUnits: 0,
          landlord: bill.unit?.property?.owner_name || 'N/A',
        }
      }
      acc[key].totalAmount += bill.total_amount || 0
      acc[key].numberOfUnits += 1
      return acc
    }, {})

    return Object.values(grouped).map((bill: any) => ({
      ...bill,
      totalAmount: `$${bill.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    }))
  } catch (error) {
    console.error('Error in getUtilityBills:', error)
    return utilityBills
  }
}

export async function getConsumptionData(): Promise<ConsumptionData[]> {
  // TODO: Replace with database query
  return consumptionData
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  // TODO: Replace with database query
  return mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase())
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  // This function is deprecated - use signIn from lib/auth.ts instead
  // Keeping for backward compatibility
  const { signIn } = await import('./auth')
  const { user } = await signIn(email, password)
  return user
}
