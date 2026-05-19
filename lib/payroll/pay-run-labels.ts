import type { PayDayType, PayFrequency } from '@/lib/data/pay-groups'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAYS_MON1_SUN7 = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type PayPeriodLabelInput = {
  year: number
  month: number
  period: number | null
  pay_frequency: PayFrequency | null
}

export type PayDateLabelInput = {
  pay_day_type: PayDayType | null
  pay_day: number | null
  pay_frequency: PayFrequency | null
  anchor_date: string | null
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`
  const rem = day % 10
  if (rem === 1) return `${day}st`
  if (rem === 2) return `${day}nd`
  if (rem === 3) return `${day}rd`
  return `${day}th`
}

function formatShortDate(date: Date): string {
  const weekday = SHORT_WEEKDAYS[date.getDay()]
  const month = MONTH_NAMES[date.getMonth()]?.slice(0, 3) ?? ''
  return `${weekday}, ${date.getDate()} ${month} ${date.getFullYear()}`
}

/** Last Monday–Friday of the given calendar month. */
function lastWorkingDayOfMonth(year: number, month: number): Date {
  const lastDay = new Date(year, month, 0).getDate()
  for (let d = lastDay; d >= 1; d--) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    if (dow >= 1 && dow <= 5) return date
  }
  return new Date(year, month - 1, lastDay)
}

function clampDayInMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month, 0).getDate()
  const d = Math.min(Math.max(1, day), lastDay)
  return new Date(year, month - 1, d)
}

export function formatPayPeriodLabel(input: PayPeriodLabelInput): string {
  const monthName = MONTH_NAMES[input.month - 1] ?? `M${input.month}`
  const base = `${monthName}, ${input.year}`
  if (input.period == null) return base
  if (input.pay_frequency === 'WEEKLY') return `${base} - Week ${input.period}`
  if (input.pay_frequency === 'BI_WEEKLY') {
    return `${base} - ${input.period === 1 ? '1st Half' : '2nd Half'}`
  }
  return base
}

export function formatPayDateLabel(
  payGroup: PayDateLabelInput,
  year: number,
  month: number
): string {
  if (payGroup.pay_day_type === 'LAST_WORKING_DAY') {
    const date = lastWorkingDayOfMonth(year, month)
    return `Last working day (${formatShortDate(date)})`
  }

  if (payGroup.pay_frequency === 'MONTHLY' && payGroup.pay_day_type === 'FIXED_DAY') {
    if (payGroup.pay_day != null && payGroup.pay_day >= 1 && payGroup.pay_day <= 31) {
      const date = clampDayInMonth(year, month, payGroup.pay_day)
      return `${ordinalSuffix(payGroup.pay_day)} (${formatShortDate(date)})`
    }
    return '—'
  }

  if (
    (payGroup.pay_frequency === 'WEEKLY' || payGroup.pay_frequency === 'BI_WEEKLY') &&
    payGroup.pay_day != null &&
    payGroup.pay_day >= 1 &&
    payGroup.pay_day <= 7
  ) {
    const name = WEEKDAYS_MON1_SUN7[payGroup.pay_day - 1]
    if (payGroup.pay_frequency === 'BI_WEEKLY' && payGroup.anchor_date) {
      return `${name} (${payGroup.anchor_date})`
    }
    return name
  }

  if (payGroup.pay_frequency === 'DAILY') return 'Daily'

  return '—'
}
