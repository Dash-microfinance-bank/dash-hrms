"use client"

// import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
// import Logo from "../public/dash.png"
// import AppleDownloadBlack from "../public/apple-download.black.svg"
// import GoogleDownloadBlack from "../public/google-play-badge-black.svg"

// type Props = {}

const Navbar = () => {

    const [ open, setOpen ] = useState<boolean>(false)
    const [ dropdown, setDropdown ] = useState<null | "personal" | "business" | "company">(null)
    // const [ showAppModal, setShowAppModal ] = useState<boolean>(false)
    const [ showNotifications, setShowNotifications ] = useState<boolean>(false)
    const [ showUserMenu, setShowUserMenu ] = useState<boolean>(false)

    const handleNavbarToggle = () => {
        setOpen(prev => !prev)
        setDropdown(null)
        return;
    }

    const handleMobileDropdown = (tab: null | "personal" | "business" | "company") => {
        setDropdown(tab)
        return;
    }

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [open])

    return (
        <>
            <nav className='w-full flex justify-between items-center px-3 lg:px-20 py-4 sticky top-0 left-0 z-40 navbar backdrop-blur-sm bg-[#FBF7FD]/95 border-b border-slate-200'>
                <Link href={"/"} className="transition-smooth hover:opacity-80" aria-label="Dash Home">DashHR</Link>
                <div className='hidden xl:flex justify-between items-center space-x-2 text-sm font-medium'>
                    {/* <Link className='py-2 px-4 transition-smooth hover:text-primary rounded-lg' href={"/"}>Home</Link> */}
                    <div className='relative personal-banking-dropdown py-2 px-4' onMouseEnter={() => setDropdown("personal")} onMouseLeave={() => setDropdown(null)}>
                        <button 
                            className='flex items-center cursor-pointer transition-smooth hover:text-primary'
                            aria-expanded={dropdown === "personal"}
                            aria-haspopup="true"
                            aria-label="Personal Banking Menu"
                        >
                            <span>Request</span>
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24" 
                                fill="currentColor" 
                                className={`size-4 ml-1 transition-transform duration-300 ${dropdown === "personal" ? "rotate-180" : ""}`}
                            >
                                <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <ul className={`absolute top-4 left-0 mt-2 rounded-md w-50 pt-5 bg-transparent transition-all duration-300 ease-out ${
                                dropdown === "personal" 
                                    ? "opacity-100 translate-y-0 pointer-events-auto" 
                                    : "opacity-0 -translate-y-2 pointer-events-none"
                            }`}
                            role="menu"
                            aria-label="Personal Banking Submenu">
                            <div className='bg-white py-4 space-y-0 shadow-lg rounded-lg border border-gray-100'>
                                <li><Link href={"/dashboard/profile-update-request"} className='block py-3 px-5 transition-smooth hover:bg-slate-100' role="menuitem">Profile Update</Link></li>
                                <li><Link href={"/"} className='block py-3 px-5 transition-smooth hover:bg-slate-100' role="menuitem">Leave</Link></li>
                                <li><Link href={"/"} className='block py-3 px-5 transition-smooth hover:bg-slate-100' role="menuitem">Raise a grievance</Link></li>
                                <li><Link href={"/"} className='block py-3 px-5 transition-smooth hover:bg-slate-100' role="menuitem">Exit</Link></li>
                            </div>
                        </ul>
                    </div>
                    <div className='relative business-banking-dropdown py-2 px-4' onMouseEnter={() => setDropdown("business")} onMouseLeave={() => setDropdown(null)}>
                        <button 
                            className='flex items-center cursor-pointer transition-smooth hover:text-primary'
                            aria-expanded={dropdown === "business"}
                            aria-haspopup="true"
                            aria-label="Business Banking Menu"
                        >
                            <span>payroll</span>
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24" 
                                fill="currentColor" 
                                className={`size-4 ml-1 transition-transform duration-300 ${dropdown === "business" ? "rotate-180" : ""}`}
                            >
                                <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <ul 
                            className={`absolute top-4 left-0 mt-2 rounded-md w-64 pt-5 bg-transparent transition-all duration-300 ease-out ${
                                dropdown === "business" 
                                    ? "opacity-100 translate-y-0 pointer-events-auto" 
                                    : "opacity-0 -translate-y-2 pointer-events-none"
                            }`}
                            role="menu"
                            aria-label="Business Banking Submenu"
                        >
                            <div className='bg-white py-4 space-y-0 shadow-lg rounded-lg border border-gray-100'>
                                <li><Link href={"/"} className='block py-3 px-5 transition-smooth hover:bg-slate-100' role="menuitem">Payslip</Link></li>
                            </div>
                        </ul>
                    </div>
                    <div className='relative company-dropdown py-2 px-4' onMouseEnter={() => setDropdown("company")} onMouseLeave={() => setDropdown(null)}>
                        <button 
                            className='flex items-center cursor-pointer transition-smooth hover:text-primary'
                            aria-expanded={dropdown === "company"}
                            aria-haspopup="true"
                            aria-label="Company Menu"
                        >
                            <span>Company</span>
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24" 
                                fill="currentColor" 
                                className={`size-4 ml-1 transition-transform duration-300 ${dropdown === "company" ? "rotate-180" : ""}`}
                            >
                                <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <ul 
                            className={`absolute top-4 left-0 mt-2 rounded-md w-60 pt-5 bg-transparent transition-all duration-300 ease-out ${
                                dropdown === "company" 
                                    ? "opacity-100 translate-y-0 pointer-events-auto" 
                                    : "opacity-0 -translate-y-2 pointer-events-none"
                            }`}
                            role="menu"
                            aria-label="Company Submenu"
                        >
                            <div className='bg-white py-4 space-y-0 shadow-lg rounded-lg border border-gray-100'>
                                {/* <li><Link href={"/team"} className='block py-3 px-5 transition-smooth hover:bg-slate-100 rounded-lg hover:translate-x-1' role="menuitem">Team</Link></li> */}
                                <li><Link href={"/"} className='block py-3 px-5 transition-smooth hover:bg-slate-100' role="menuitem">Documents</Link></li>
                                <li><Link href={"/"} className='block py-3 px-5 transition-smooth hover:bg-slate-100' role="menuitem">Organogram</Link></li>
                            </div>
                        </ul>
                    </div>
                    <div className='relative'>
                        <button
                            type="button"
                            onClick={() => setShowNotifications(prev => !prev)}
                            className='relative p-2 rounded-full hover:bg-slate-100 focus:outline-none! focus-visible:ring-0! focus-visible:ring-offset-0! focus:ring-0 focus:ring-primary/50'
                            aria-label="Notifications"
                            aria-expanded={showNotifications}
                        >
                            <span className='absolute -top-0.6 -right-0.6 inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white' />
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className='size-5 text-slate-700'
                            >
                                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                        </button>
                        {showNotifications && (
                            <div className='absolute right-0 mt-3 w-72 bg-white shadow-lg rounded-lg border border-slate-100 py-2 z-50'>
                                <div className='px-4 py-2 border-b border-slate-100'>
                                    <p className='text-sm font-medium text-slate-900'>Notifications</p>
                                    <p className='text-xs text-slate-500'>You have 3 new updates</p>
                                </div>
                                <ul className='max-h-64 overflow-auto text-sm'>
                                    <li className='px-4 py-3 hover:bg-slate-50 cursor-pointer'>
                                        <p className='font-medium text-slate-800'>Upcoming birthday: Jane Doe</p>
                                        <p className='text-xs text-slate-500 mt-1'>In 3 days</p>
                                    </li>
                                    <li className='px-4 py-3 hover:bg-slate-50 cursor-pointer'>
                                        <p className='font-medium text-slate-800'>Public holiday: Independence Day</p>
                                        <p className='text-xs text-slate-500 mt-1'>Next week</p>
                                    </li>
                                    <li className='px-4 py-3 hover:bg-slate-50 cursor-pointer'>
                                        <p className='font-medium text-slate-800'>Work anniversary: John Smith</p>
                                        <p className='text-xs text-slate-500 mt-1'>Today</p>
                                    </li>
                                </ul>
                                <button
                                    type="button"
                                    className='w-full text-center text-xs text-primary font-medium py-2 hover:bg-slate-50'
                                >
                                    View all notifications
                                </button>
                            </div>
                        )}
                    </div>
                    <div className='relative'>
                        <button
                            type="button"
                            onClick={() => setShowUserMenu(prev => !prev)}
                            className='flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50 focus:outline-none focus:ring-primary/50! focus-visible:ring-0! focus-visible:ring-offset-0! focus:ring-0'
                            aria-label="Open user menu"
                            aria-expanded={showUserMenu}
                        >
                            <Avatar className='h-8 w-8'>
                                <AvatarImage src="https://github.com/shadcn.png" alt="User avatar" />
                                <AvatarFallback>EO</AvatarFallback>
                            </Avatar>
                            <span className='hidden lg:inline text-sm font-medium text-slate-800'>
                                Emmanuel
                            </span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`size-4 text-slate-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                            >
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </button>
                        {showUserMenu && (
                            <div className='absolute right-0 mt-2 w-56 rounded-lg border border-slate-100 bg-white shadow-lg z-50'>
                                <div className='px-4 py-3 border-b border-slate-100'>
                                    <p className='text-sm font-medium text-slate-900'>Account</p>
                                    <p className='text-xs text-slate-500'>Switch between areas</p>
                                </div>
                                <ul className='py-1 text-sm'>
                                    <li>
                                        <Link
                                            href="/dashboard/system"
                                            className='block px-4 py-2 hover:bg-slate-50 text-slate-800'
                                        >
                                            System control
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/dashboard/admin"
                                            className='block px-4 py-2 hover:bg-slate-50 text-slate-800'
                                        >
                                            Admin
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/dashboard/manager"
                                            className='block px-4 py-2 hover:bg-slate-50 text-slate-800'
                                        >
                                            Manager
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/dashboard"
                                            className='block px-4 py-2 hover:bg-slate-50 text-slate-800'
                                        >
                                            Employee self service
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
                <div className='flex xl:hidden items-center space-x-5'>
                    <Sheet>
                        <SheetTrigger asChild>
                            <button
                                type="button"
                                className="relative flex items-center justify-center rounded-full border border-slate-200 bg-white p-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                                aria-label="Open notifications"
                            >
                                <span className="absolute -top-0.5 -right-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="size-[18px] text-slate-700"
                                >
                                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                </svg>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-4">
                            <SheetHeader>
                                <SheetTitle className="text-center text-base">Notifications</SheetTitle>
                            </SheetHeader>
                            <div className="mt-2 space-y-2 text-sm">
                                <div className="rounded-lg bg-slate-50 px-4 py-3">
                                    <p className="font-medium text-slate-900">Upcoming birthday: Jane Doe</p>
                                    <p className="mt-1 text-xs text-slate-500">In 3 days</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-4 py-3">
                                    <p className="font-medium text-slate-900">Public holiday: Independence Day</p>
                                    <p className="mt-1 text-xs text-slate-500">Next week</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-4 py-3">
                                    <p className="font-medium text-slate-900">Work anniversary: John Smith</p>
                                    <p className="mt-1 text-xs text-slate-500">Today</p>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                    <Sheet>
                        <SheetTrigger asChild>
                            <button
                                type="button"
                                className="flex items-center justify-center rounded-full border border-slate-200 bg-white p-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                                aria-label="Open role switcher"
                            >
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src="https://github.com/shadcn.png" alt="User avatar" />
                                    <AvatarFallback>EO</AvatarFallback>
                                </Avatar>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-4">
                            <SheetHeader>
                                <SheetTitle className="text-center text-base">Switch area</SheetTitle>
                            </SheetHeader>
                            <div className="mt-2 space-y-2">
                                <Link
                                    href="/dashboard/system"
                                    className="block rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-100"
                                >
                                    System control
                                </Link>
                                <Link
                                    href="/dashboard/admin"
                                    className="block rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-100"
                                >
                                    Admin
                                </Link>
                                <Link
                                    href="/dashboard/manager"
                                    className="block rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-100"
                                >
                                    Manager
                                </Link>
                                <Link
                                    href="/dashboard"
                                    className="block rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-100"
                                >
                                    Employee self service
                                </Link>
                            </div>
                        </SheetContent>
                    </Sheet>
                    <button 
                        type='button' 
                        onClick={handleNavbarToggle}
                        className="transition-smooth hover:opacity-70 active:scale-95"
                        aria-label={open ? "Close menu" : "Open menu"}
                        aria-expanded={open}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                            <path fillRule="evenodd" d="M3 9a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 9Zm0 6.75a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </nav>
            {/* Mobile Menu Overlay */}
            <div className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
                    open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
                onClick={handleNavbarToggle}
                aria-hidden="true"
            />
            <div className={`w-full h-full fixed top-0 right-0 bg-white mobile-menubar z-50 navbar transition-transform duration-300 ease-out ${
                open ? "translate-x-0" : "translate-x-full"
            }`}>
                <nav className='w-full flex justify-between items-center px-3 lg:px-10 py-5 sticky top-0 left-0'>
                    {dropdown === null ? (
                        <Link href={"/"} className="transition-smooth hover:opacity-80" aria-label="Dash MFB Home">
                            <span className="text-2xl font-bold">Logo</span>
                        </Link>
                    ) : (
                        <button 
                            className='flex items-center mr-1 transition-smooth hover:opacity-70 active:scale-95' 
                            type="button" 
                            onClick={() => handleMobileDropdown(null)}
                            aria-label="Back to main menu"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75 3 12m0 0 3.75-3.75M3 12h18" />
                            </svg>
                        </button>
                    )}
                    <div className='flex lg:hidden items-center space-x-4'>
                        <button 
                            type="button" 
                            onClick={handleNavbarToggle}
                            className="transition-smooth hover:opacity-70 active:scale-95"
                            aria-label="Close menu"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                                <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </nav>
                <div className='px-3 mt-5 overflow-hidden'>
                    <div className={`main-category space-y-5 w-full transition-all duration-300 ease-out ${
                        dropdown === null 
                            ? "opacity-100 translate-x-0" 
                            : "opacity-0 -translate-x-4 pointer-events-none absolute"
                    }`}>
                        <Link className='block py-2 text-xl font-medium transition-smooth hover:text-primary hover:translate-x-2' href={"/"}>Home</Link>
                        <button 
                            className='flex items-center cursor-pointer personal-banking-dropdown justify-between w-full py-2 text-xl font-medium transition-smooth hover:text-primary' 
                            onClick={() => handleMobileDropdown("personal")}
                            aria-expanded={dropdown === "personal"}
                        >
                            <span>Requests</span>
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24" 
                                fill="currentColor" 
                                className={`size-5 transition-transform duration-300 ${dropdown === "personal" ? "" : ""}`}
                            >
                                <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <button 
                            className='flex items-center justify-between cursor-pointer business-banking-dropdown w-full py-2 text-xl font-medium transition-smooth hover:text-primary' 
                            onClick={() => handleMobileDropdown("business")}
                            aria-expanded={dropdown === "business"}
                        >
                            <span>Payroll</span>
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24" 
                                fill="currentColor" 
                                className={`size-5 transition-transform duration-300 ${dropdown === "business" ? "" : ""}`}
                            >
                                <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <button 
                            className='flex items-center cursor-pointer company-dropdown justify-between w-full py-2 text-xl font-medium transition-smooth hover:text-primary' 
                            onClick={() => handleMobileDropdown("company")}
                            aria-expanded={dropdown === "company"}
                        >
                            <span>Company</span>
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24" 
                                fill="currentColor" 
                                className={`size-5 transition-transform duration-300 ${dropdown === "company" ? "" : ""}`}
                            >
                                <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clipRule="evenodd" />
                            </svg>
                        </button>
                        {/* <Link className='block py-2 text-xl font-medium transition-smooth hover:text-primary hover:translate-x-2' href={"/"}>Investor Relations</Link> */}
                    </div>
                    <div className={`personal-category space-y-5 w-full transition-all duration-300 ease-out ${
                        dropdown === "personal" 
                            ? "opacity-100 translate-x-0" 
                            : "opacity-0 translate-x-4 pointer-events-none absolute"
                    }`}>
                        <Link className='block py-2 text-xl font-medium transition-smooth hover:text-primary hover:translate-x-2' href={"/dashboard/profile-update-request"}>Profile update</Link>
                        <Link className='block py-2 text-xl font-medium transition-smooth hover:text-primary hover:translate-x-2' href={"/"}>Leave</Link>
                        <Link className='block py-2 text-xl font-medium transition-smooth hover:text-primary hover:translate-x-2' href={"/"}>Raise a grievance</Link>
                        <Link className='block py-2 text-xl font-medium transition-smooth hover:text-primary hover:translate-x-2' href={"/"}>Exit</Link>
                    </div>
                    <div className={`business-category space-y-5 transition-all duration-300 ease-out ${
                        dropdown === "business" 
                            ? "opacity-100 translate-x-0" 
                            : "opacity-0 translate-x-4 pointer-events-none absolute"
                    }`}>
                        <Link className='block py-2 text-xl font-medium transition-smooth hover:text-primary hover:translate-x-2' href={"/"}>Payslip</Link>
                    </div>
                    <div className={`Company-category space-y-5 transition-all duration-300 ease-out ${
                        dropdown === "company" 
                            ? "opacity-100 translate-x-0" 
                            : "opacity-0 translate-x-4 pointer-events-none absolute"
                    }`}>
                        {/* <Link className='block py-2 text-xl font-medium transition-smooth hover:text-primary hover:translate-x-2' href={"/team"}>Team</Link> */}
                        <Link className='block py-2 text-xl font-medium transition-smooth hover:text-primary hover:translate-x-2' href={"/"}>Documents</Link>
                        <Link className='block py-2 text-xl font-medium transition-smooth hover:text-primary hover:translate-x-2' href={"/"}>Organogram</Link>
                    </div>
                </div>
            </div>
        </>
        
    )
}

export default Navbar