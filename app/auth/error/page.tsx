import Link from 'next/link'

type SearchParams = Promise<{ message?: string }>

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const message = params.message ?? 'Something went wrong.'

  return (
    <section className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-4xl font-bold text-red-600 mb-2">Authentication Error</h1>
      <p className="text-gray-700 mb-6 text-center">{message}</p>
      <Link
        href="/"
        className="text-primary font-medium hover:underline"
      >
        Return home
      </Link>
    </section>
  )
}
