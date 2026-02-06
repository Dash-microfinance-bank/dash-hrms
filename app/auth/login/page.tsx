import React, { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import LoginFormSwitcher from '@/components/form/LoginFormSwitcher'

export default function LoginPage() {
    return (
        <section className='flex h-screen w-full'>
            <div className='hidden lg:block lg:w-1/2 h-full relative'>
                <div className='w-full h-full flex items-center justify-center relative'>
                    <Image
                        src="https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                        alt="login"
                        fill
                        className="object-cover"
                        sizes="50vw"
                        priority
                    />
                    <div className='absolute top-0 left-0 w-full h-full bg-black/60 flex items-center justify-center'>
                        <h1 className='text-white text-7xl font-bold text-center'>Human Resource Portal</h1>
                    </div>
                </div>
            </div>
            <div className='lg:w-1/2 w-full h-full flex flex-col items-center justify-between'>
                <div className='w-full px-3 py-5 flex items-center justify-center'>
                    <Link href="/auth/terms" className='text-sm text-center text-gray-500 hover:text-primary/80 transition-all duration-300 mr-1'>Terms of Service  | </Link>   
                    <Link href="/auth/terms" className='text-sm text-center text-gray-500 hover:text-primary/80 transition-all duration-300'>Privacy Policy</Link>
                </div>
                <div className="w-full max-w-[350px] px-3">
                    <Suspense fallback={<div className="w-full h-[200px]" />}>
                        <LoginFormSwitcher />
                    </Suspense>
                </div>
                <div className='w-full py-5 space-y-2'>
                    <p className='text-sm text-center text-gray-500'>© 2026 <span className='font-bold'>Dash HRM</span>. All rights reserved.</p>
                    <p className='text-sm text-center text-gray-500'>Powered by <a href="https://dash-mfb.com" target='_blank' className="text-primary hover:text-primary/80 transition-all duration-300 font-bold">Dash</a></p>
                </div>
            </div>
        </section>
    )
}