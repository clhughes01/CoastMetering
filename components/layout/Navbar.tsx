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
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center space-x-4">
            {children}
            {showHomeLink && (
              <Link
                href={ROUTES.HOME}
                className="text-gray-600 hover:text-gray-900"
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
