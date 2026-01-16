/**
 * Application constants
 * Centralized configuration values
 */

export const APP_NAME = 'Coast Metering'

export { US_STATES } from './states'

export const ROUTES = {
  HOME: '/',
  ADMIN: {
    ROOT: '/admin',
    PROPERTIES: '/admin/properties',
    PROPERTY_DETAIL: (id: string) => `/admin/properties/${id}`,
  },
  TENANT: {
    ROOT: '/tenant',
    DASHBOARD: '/tenant/dashboard',
  },
  API: {
    INGEST: {
      BADGER_ORION: '/api/ingest/badger-orion',
      CHINESE_DEVICE: '/api/ingest/chinese-device',
    },
  },
} as const

export const METER_TYPES = ['water', 'power', 'gas'] as const

export const DEVICE_TYPES = ['badger_orion', 'chinese_device'] as const

export const READING_SOURCES = ['badger_orion', 'chinese_device', 'manual'] as const

export const USER_ROLES = ['admin', 'tenant'] as const
