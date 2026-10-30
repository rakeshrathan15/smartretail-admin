const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

/** ₹1,440 or ₹1,440.5 with Indian digit grouping. */
export function formatRupees(amount: number): string {
  return rupees.format(amount).replace(/\.00$/, '')
}

const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
})

/** "25 Oct, 4:59 pm" in India time. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

/** Today's date in India as yyyy-mm-dd, for date filters. */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

/** yyyy-mm-dd plus some days, for date inputs. */
export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`)
  moved.setUTCDate(moved.getUTCDate() + days)
  return moved.toISOString().slice(0, 10)
}

const day = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** "Mon, 2 Nov" for a yyyy-mm-dd date. */
export function formatDay(date: string): string {
  return day.format(new Date(`${date}T00:00:00Z`))
}
