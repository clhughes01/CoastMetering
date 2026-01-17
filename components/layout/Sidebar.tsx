'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ROUTES } from '@/lib/constants'

const navigation = [
  { name: 'Dashboard', href: ROUTES.ADMIN.ROOT, icon: '📊' },
  { name: 'Properties', href: '/admin/properties', icon: '🏢' },
  { name: 'Customer Statements', href: ROUTES.ADMIN.STATEMENTS, icon: '📄' },
  { name: 'Monthly Bills', href: ROUTES.ADMIN.BILLS, icon: '💰' },
]

export const Sidebar = () => {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen fixed left-0 top-0 pt-16">
      <nav className="px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href === '/admin/properties' && pathname.startsWith('/admin/properties'))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200
                ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm">{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
