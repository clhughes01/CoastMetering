// ===========================================
// CORE DATA TYPES
// These types define the shape of your data.
// When connecting to a database, your queries
// should return data matching these interfaces.
// ===========================================

export type UserRole = "manager" | "tenant"

export interface User {
  id: string
  email: string
  role: UserRole
  name: string
  phone?: string
  createdAt: Date
  updatedAt: Date
  // For managers
  companyName?: string
  // For tenants
  accountNumber?: string
  propertyId?: string
  unitId?: string
}

export interface Property {
  id: string
  managerId: string
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  createdAt: Date
  updatedAt: Date
}

export interface Unit {
  id: string
  propertyId: string
  unitNumber: string
  meterId?: string
  tenantId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Customer {
  id: number
  accountNumber: string
  residentName: string
  unit: string
  streetAddress: string
  city: string
  zipCode: string
  email: string
  phone: string
  landlordName: string
  propertyId?: string
  userId?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface Statement {
  id: number
  accountNumber: string
  residentName: string
  unit: string
  streetAddress: string
  city: string
  startDate: string
  endDate: string
  amountDue: string
  changeLastMonth: string
  amountPaid: string
  dueDate: string
  landlordName: string
  status: "paid" | "pending" | "overdue"
  pdfUrl?: string
  customerId?: number
  createdAt?: Date
}

export interface Payment {
  id: number
  accountNumber: string
  residentName: string
  dateBilled: string
  totalAmount: string
  landlordName: string
  status: "PENDING" | "succeeded" | "requires_payment_method" | "failed"
  statementId?: number
  stripePaymentId?: string
  createdAt?: Date
}

export interface UtilityBill {
  id: number
  month: string
  year: number
  billDate: string
  totalAmount: string
  numberOfUnits: number
  landlord: string
  propertyId?: string
  masterSheetUrl?: string
  excelUrl?: string
  pdfUrl?: string
  createdAt?: Date
}

export interface MeterReading {
  id: string
  meterId: string
  unitId: string
  readingValue: number
  readingDate: Date
  previousReading?: number
  consumption?: number
  createdAt: Date
}

export interface ConsumptionData {
  month: string
  consumption: number
  year?: number
}

// ===========================================
// API RESPONSE TYPES
// Use these for type-safe API responses
// ===========================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ===========================================
// FILTER/QUERY TYPES
// Use these for filtering data from the database
// ===========================================

export interface DateRange {
  startDate: Date
  endDate: Date
}

export interface StatementFilters {
  month?: string
  year?: number
  status?: Statement["status"]
  customerId?: number
}

export interface PaymentFilters {
  month?: string
  year?: number
  status?: Payment["status"]
  customerId?: number
}

export interface CustomerFilters {
  search?: string
  propertyId?: string
  landlordName?: string
}
