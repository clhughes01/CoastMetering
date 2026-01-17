import React from 'react'
import { Sidebar } from './Sidebar'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
  showSidebar?: boolean
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = '',
  showSidebar = true,
}) => {
  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 ${className}`}>
      {showSidebar && <Sidebar />}
      <div className={showSidebar ? 'ml-64' : ''}>
        {children}
      </div>
    </div>
  )
}
