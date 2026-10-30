import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { expensesApi, type Expense, type ExpenseCategory, type ExpenseFilters } from '../api/purchasing'
import { Button, ErrorBanner, Field, PageHeader, Pager, Spinner, Stat } from '../components/ui'
import { confirmAction } from '../lib/confirm'
import { formatDay, formatRupees, todayInIndia } from '../lib/format'
import { categoryLabel, EXPENSE_CATEGORIES, expenseFormErrors, formFromExpense, inputFromExpenseForm, type ExpenseFormValues } from './purchasingForms'

const firstOfMonth = () => `${todayInIndia().slice(0, 8)}01`

export function ExpensesPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ExpenseFilters>(() => ({ from: firstOfMonth(), to: todayInIndia(), category: '' }))
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const expenses = useQuery({
    queryKey: ['expenses', 'list', filters, page],
    queryFn: () => expensesApi.list(filters, page),
    placeholderData: keepPreviousData,
  })
  const summary = useQuery({ queryKey: ['expenses', 'summary', filters], queryFn: () => expensesApi.summary(filters) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['expenses'] })
  const remove = useMutation({ mutationFn: (e: Expense) => expensesApi.remove(e.id), onSuccess: refresh })
  const data = expenses.data
  const filter = (changes: Partial<ExpenseFilters>) => {
    setFilters((f) => ({ ...f, ...changes }))
    setPage(0)
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Money spent running the business, such as rent, salaries and diesel."
        actions={editing === null && <Button onClick={() => setEditing('new')}>+ Add expense</Button>}
      />
      {editing !== null && (
        <ExpenseForm
          key={editing === 'new' ? 'new' : editing.id}
          expense={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <Field label="From">
          <input className="input" type="date" value={filters.from} onChange={(e) => filter({ from: e.target.value })} />
        </Field>
        <Field label="To">
          <input className="input" type="date" value={filters.to} onChange={(e) => filter({ to: e.target.value })} />
        </Field>
        <Field label="Show category">
          <select className="input" value={filters.category} onChange={(e) => filter({ category: e.target.value })}>
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorBanner message={expenses.error?.message ?? summary.error?.message ?? remove.error?.message} />
      {summary.data && (
        <dl className="my-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Total expenses" value={formatRupees(summary.data.total)} />
          {summary.data.byCategory.slice(0, 3).map((c) => (
            <Stat key={c.category} label={categoryLabel(c.category)} value={formatRupees(c.total)} />
          ))}
        </dl>
      )}
      <div className="card overflow-x-auto">
        {expenses.isPending ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No expenses for these dates.
                  </td>
                </tr>
              )}
              {data?.items.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDay(e.expenseDate)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.title}</div>
                    {e.description && <div className="text-xs text-slate-500">{e.description}</div>}
                  </td>
                  <td className="px-4 py-3">{categoryLabel(e.category)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatRupees(e.amount)}</td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    <Button variant="secondary" onClick={() => setEditing(e)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      busy={remove.isPending && remove.variables?.id === e.id}
                      onClick={() => confirmAction(`Delete the expense "${e.title}"?`) && remove.mutate(e)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && <Pager page={data.page} totalPages={data.totalPages} totalItems={data.totalItems} noun="expenses" onPage={setPage} />}
    </>
  )
}

function ExpenseForm({ expense, onDone, onCancel }: { expense: Expense | null; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<ExpenseFormValues>(() =>
    expense ? formFromExpense(expense) : { title: '', category: 'GENERAL', amount: '', description: '', expenseDate: todayInIndia() },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () => {
      const body = inputFromExpenseForm(form)
      return expense ? expensesApi.update(expense.id, body) : expensesApi.create(body)
    },
    onSuccess: onDone,
    onError: (e) => setErrors(e instanceof ApiError ? e.fieldErrors : {}),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const problems = expenseFormErrors(form, todayInIndia())
    setErrors(problems)
    if (Object.keys(problems).length === 0) save.mutate()
  }

  const update = (changes: Partial<ExpenseFormValues>) => setForm((f) => ({ ...f, ...changes }))

  return (
    <form onSubmit={submit} className="card mb-4 space-y-4 p-5" noValidate>
      <h2 className="font-semibold">{expense ? `Edit ${expense.title}` : 'New expense'}</h2>
      <ErrorBanner message={save.error && Object.keys(errors).length === 0 ? save.error.message : null} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Title *" error={errors.title}>
          <input className="input" value={form.title} onChange={(e) => update({ title: e.target.value })} />
        </Field>
        <Field label="Category">
          <select className="input" value={form.category} onChange={(e) => update({ category: e.target.value as ExpenseCategory })}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount ₹ *" error={errors.amount}>
          <input className="input" inputMode="decimal" value={form.amount} onChange={(e) => update({ amount: e.target.value })} />
        </Field>
        <Field label="Expense date *" error={errors.expenseDate}>
          <input className="input" type="date" max={todayInIndia()} value={form.expenseDate} onChange={(e) => update({ expenseDate: e.target.value })} />
        </Field>
      </div>
      <Field label="Description" error={errors.description}>
        <input className="input" value={form.description} onChange={(e) => update({ description: e.target.value })} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" busy={save.isPending}>
          {expense ? 'Save' : 'Add expense'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
