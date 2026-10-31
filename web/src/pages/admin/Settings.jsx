import { useState } from 'react'
import { useSettings, useUpdateSettings } from '../../api/hooks.js'
import { ErrorMessage, Loading, PageHeader } from '../../components/Feedback.jsx'

function SettingsForm({ settings }) {
  const update = useUpdateSettings()
  const [form, setForm] = useState({
    timeLimitMin: String(settings.timeLimitMin),
    graceMin: String(settings.graceMin),
    officeClose: settings.officeClose
  })
  const [saved, setSaved] = useState(false)
  const set = (field) => (e) => { setSaved(false); setForm({ ...form, [field]: e.target.value }) }

  const submit = (e) => {
    e.preventDefault()
    update.mutate(
      { timeLimitMin: Number(form.timeLimitMin), graceMin: Number(form.graceMin), officeClose: form.officeClose },
      { onSuccess: () => setSaved(true) }
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <label htmlFor="s-limit" className="label">Time limit (minutes)</label>
        <input id="s-limit" type="number" min={1} max={600} required className="input" value={form.timeLimitMin} onChange={set('timeLimitMin')} aria-describedby="s-limit-help" />
        <p id="s-limit-help" className="mt-1 text-xs text-slate-500">Entries longer than this show N in the register. Exactly the limit counts as Y.</p>
      </div>
      <div>
        <label htmlFor="s-grace" className="label">Grace period (minutes)</label>
        <input id="s-grace" type="number" min={0} max={240} required className="input" value={form.graceMin} onChange={set('graceMin')} aria-describedby="s-grace-help" />
        <p id="s-grace-help" className="mt-1 text-xs text-slate-500">An open entry gets the remark “Exceeded time limit” after limit + grace.</p>
      </div>
      <div>
        <label htmlFor="s-close" className="label">Office close time (IST)</label>
        <input id="s-close" type="time" required className="input" value={form.officeClose} onChange={set('officeClose')} aria-describedby="s-close-help" />
        <p id="s-close-help" className="mt-1 text-xs text-slate-500">
          At the end-of-day run, entries that started before this time and are still open get “Time In not recorded”.
          The run itself is scheduled at 17:30 IST in the Worker configuration.
        </p>
      </div>
      <ErrorMessage error={update.error} />
      {saved && <p role="status" className="text-sm text-emerald-800">Settings saved.</p>}
      <button type="submit" className="btn-primary" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save settings'}</button>
    </form>
  )
}

export default function Settings() {
  const { data, isPending, error } = useSettings()
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Settings" />
      {isPending ? <Loading lines={4} /> : error ? <ErrorMessage error={error} /> : <SettingsForm settings={data} />}
    </div>
  )
}
