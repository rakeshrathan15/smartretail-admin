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
