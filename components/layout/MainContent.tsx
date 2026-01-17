import React from 'react'

interface MainContentProps {
  children: React.ReactNode
  className?: string
}

export const MainContent: React.FC<MainContentProps> = ({
  children,
  className = '',
}) => {
  return (
    <main className={`max-w-[1600px] mx-auto px-6 lg:px-8 py-8 ${className}`}>
      {children}
    </main>
  )
}
