import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Coast Metering
        </h1>
        <p className="text-gray-600 mb-8">
          Submetering Platform for Property Management
        </p>
        <div className="space-x-4">
          <Link
            href="/admin"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Admin Portal
          </Link>
          <Link
            href="/tenant"
            className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Tenant Portal
          </Link>
        </div>
      </div>
    </main>
  )
}
