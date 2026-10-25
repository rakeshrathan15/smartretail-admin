import type { OrderStatus, PaymentMethod, PaymentStatus } from '../api/types'

export const statusLabels: Record<OrderStatus, string> = {
  PLACED: 'New',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
}

/** The button text for moving an order to a status. */
export const statusActions: Record<OrderStatus, string> = {
  PLACED: 'Mark new',
  CONFIRMED: 'Confirm order',
  PROCESSING: 'Start processing',
  PACKED: 'Mark packed',
  SHIPPED: 'Mark shipped (courier)',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Mark delivered',
  CANCELLED: 'Cancel order',
  RETURNED: 'Mark returned',
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  COD: 'Cash on delivery',
  UPI: 'UPI',
  CREDIT: 'Credit',
  CASH: 'Cash (counter)',
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: 'Unpaid',
  PENDING_VERIFICATION: 'Check UPI',
  PAID: 'Paid',
  FAILED: 'Payment rejected',
  REFUNDED: 'Refunded',
}

type Tone = 'green' | 'gray' | 'amber' | 'red' | 'blue'

export const statusTone = (status: OrderStatus): Tone =>
  status === 'PLACED'
    ? 'amber'
    : status === 'DELIVERED'
      ? 'green'
      : status === 'CANCELLED' || status === 'RETURNED'
        ? 'red'
        : 'blue'

export const paymentTone = (status: PaymentStatus): Tone =>
  status === 'PAID' ? 'green' : status === 'PENDING_VERIFICATION' ? 'amber' : status === 'FAILED' ? 'red' : 'gray'
