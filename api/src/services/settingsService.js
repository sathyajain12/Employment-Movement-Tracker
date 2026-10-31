const DEFAULTS = { time_limit_min: '60', grace_min: '10', office_close: '17:30' }

export function createSettingsService({ settingsRepo }) {
  async function get() {
    const raw = { ...DEFAULTS, ...(await settingsRepo.all()) }
    return {
      timeLimitMin: Number(raw.time_limit_min),
      graceMin: Number(raw.grace_min),
      officeClose: raw.office_close
    }
  }

  async function update({ timeLimitMin, graceMin, officeClose }) {
    await settingsRepo.setMany({
      time_limit_min: timeLimitMin,
      grace_min: graceMin,
      office_close: officeClose
    })
    return get()
  }

  return { get, update }
}
