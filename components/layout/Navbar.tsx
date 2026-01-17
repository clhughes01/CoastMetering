import React from 'react'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants'

interface NavbarProps {
  title: string
  showHomeLink?: boolean
  children?: React.ReactNode
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  showHomeLink = true,
  children,
}) => {
  return (
    <nav className="bg-white shadow-soft border-b border-gray-200 fixed top-0 left-0 right-0 z-40 h-16">
      <div className="max-w-full mx-auto px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href={ROUTES.HOME} className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-white font-bold text-sm">CM</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">{title}</h1>
                  <p className="text-xs text-gray-500">Admin Portal</p>
                </div>
              </div>
            </Link>
          </div>
          <div className="flex items-center space-x-6">
            {children}
            {showHomeLink && (
              <Link
                href={ROUTES.HOME}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-gray-100"
              >
                Home
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
