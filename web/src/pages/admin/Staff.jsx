import { useState } from 'react'
import { useAddStaff, useStaffList, useUpdateStaff } from '../../api/hooks.js'
import { Badge } from '../../components/Badge.jsx'
import { EmptyState, ErrorMessage, Loading, PageHeader } from '../../components/Feedback.jsx'

function AddStaffForm() {
  const add = useAddStaff()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [added, setAdded] = useState(null)

  const submit = (e) => {
    e.preventDefault()
    add.mutate({ name, email }, {
      onSuccess: (person) => {
        setAdded(person)
        setName('')
        setEmail('')
      }
    })
  }

  return (
    <form onSubmit={submit} className="card mb-6 space-y-3" aria-labelledby="add-staff-heading">
      <h2 id="add-staff-heading" className="font-semibold">Add a staff member</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="new-name" className="label">Name</label>
          <input id="new-name" className="input" required maxLength={100} value={name} onChange={(e) => { setAdded(null); setName(e.target.value) }} />
        </div>
        <div>
          <label htmlFor="new-email" className="label">Google email</label>
          <input id="new-email" type="email" className="input" required maxLength={254} value={email} onChange={(e) => { setAdded(null); setEmail(e.target.value) }} />
        </div>
        <button type="submit" className="btn-primary" disabled={add.isPending || !name.trim() || !email.trim()}>
          {add.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
      <ErrorMessage error={add.error} />
      {added && <p role="status" className="text-sm text-emerald-800">{added.name} can now sign in with {added.email}.</p>}
    </form>
  )
}

function EditRow({ person, onDone }) {
  const update = useUpdateStaff()
  const [name, setName] = useState(person.name)
  const [email, setEmail] = useState(person.email)

  const save = (e) => {
    e.preventDefault()
    update.mutate({ id: person.id, name, email }, { onSuccess: onDone })
  }

  return (
    <li className="card p-4">
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`name-${person.id}`} className="label">Name</label>
            <input id={`name-${person.id}`} className="input" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`email-${person.id}`} className="label">Google email</label>
            <input id={`email-${person.id}`} type="email" className="input" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        {email.trim().toLowerCase() !== person.email && person.hasSignedIn && (
          <p className="text-sm text-amber-800">Changing the email unlinks their current Google account; they will sign in again with the new one.</p>
        )}
        <ErrorMessage error={update.error} />
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
        </div>
      </form>
    </li>
  )
}

function PersonRow({ person, onEdit }) {
  const update = useUpdateStaff()

  const toggleActive = () => {
    if (person.active && !window.confirm(`Deactivate ${person.name}? They will be signed out and unable to sign in.`)) return
    update.mutate({ id: person.id, active: !person.active })
  }

  return (
    <li className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${person.active ? '' : 'opacity-75'}`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {person.name}
          {person.isAdmin && <Badge tone="blue">Admin</Badge>}
          {!person.active && <Badge>Inactive</Badge>}
          {!person.hasSignedIn && <Badge tone="amber">Not signed in yet</Badge>}
        </p>
        <p className="truncate text-sm text-slate-600">{person.email}</p>
        <ErrorMessage error={update.error} className="mt-2" />
      </div>
      {person.isAdmin ? (
        <span className="text-sm text-slate-500">Managed in configuration</span>
      ) : (
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onEdit}>Edit</button>
          <button type="button" className={person.active ? 'btn-danger' : 'btn-primary'} onClick={toggleActive} disabled={update.isPending}>
            {person.active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      )}
    </li>
  )
}

export default function Staff() {
  const { data, isPending, error } = useStaffList()
  const [editingId, setEditingId] = useState(null)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Staff" />
      <AddStaffForm />
      <p className="mb-3 text-sm text-slate-600">
        Admin access is managed in configuration (<code className="rounded bg-slate-100 px-1">ADMIN_EMAILS</code>), so admins are shown read-only.
      </p>
      {isPending ? (
        <Loading lines={5} />
      ) : error ? (
        <ErrorMessage error={error} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No staff yet">Add the first staff member above.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.items.map((person) => person.id === editingId
            ? <EditRow key={person.id} person={person} onDone={() => setEditingId(null)} />
            : <PersonRow key={person.id} person={person} onEdit={() => setEditingId(person.id)} />)}
        </ul>
      )}
    </div>
  )
}
