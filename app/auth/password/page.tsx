import React from 'react'
import PasswordReset from '@/components/form/PasswordReset'

const page = () => {
    return (
        <section className='flex flex-col items-center justify-center h-screen'>
            <h1 className='text-3xl font-bold mb-10'>Create Password</h1>
            <PasswordReset />
        </section>
    )
}

export default page