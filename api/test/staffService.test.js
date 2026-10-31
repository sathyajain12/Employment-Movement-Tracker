import { describe, expect, it } from 'vitest'
import { isAdminEmail } from '../src/lib/admins.js'
import { setup } from './fakes.js'

describe('isAdminEmail', () => {
  const env = { ADMIN_EMAILS: ' Boss@Example.com ,deputy@example.com,, ' }

  it('ignores case and surrounding spaces', () => {
    expect(isAdminEmail(env, 'boss@example.com')).toBe(true)
    expect(isAdminEmail(env, '  BOSS@EXAMPLE.COM ')).toBe(true)
    expect(isAdminEmail(env, 'Deputy@Example.COM')).toBe(true)
  })

  it('rejects other and empty emails', () => {
    expect(isAdminEmail(env, 'staff@example.com')).toBe(false)
    expect(isAdminEmail(env, '')).toBe(false)
    expect(isAdminEmail({}, 'boss@example.com')).toBe(false)
  })
})

describe('Google sign-in', () => {
  it('creates a missing admin row from config on first sign-in', async () => {
    const { staffService, staffRepo } = setup()
    const row = await staffService.signIn({ email: 'Deputy@Example.com', sub: 'g-deputy', name: 'Deputy' })
    expect(row).toMatchObject({ email: 'deputy@example.com', role: 'admin', google_sub: 'g-deputy' })
    expect(staffRepo.rows).toHaveLength(5)
  })

  it('refuses unregistered non-admin emails', async () => {
    const { staffService } = setup()
    await expect(staffService.signIn({ email: 'stranger@example.com', sub: 'x' }))
      .rejects.toMatchObject({ code: 'not_registered' })
  })

  it('refuses inactive staff', async () => {
    const { staffService, staffRepo } = setup()
    staffRepo.rows[1].active = 0
    await expect(staffService.signIn({ email: 'asha@example.com', sub: 'g-asha' }))
      .rejects.toMatchObject({ code: 'inactive' })
  })

  it('stores google_sub on first sign-in and rejects a different account later', async () => {
    const { staffService } = setup()
    await staffService.signIn({ email: 'asha@example.com', sub: 'g-asha' })
    await expect(staffService.signIn({ email: 'asha@example.com', sub: 'g-asha' })).resolves.toMatchObject({ id: 2 })
    await expect(staffService.signIn({ email: 'asha@example.com', sub: 'g-other' }))
      .rejects.toMatchObject({ code: 'account_mismatch' })
  })

  it('demotes a former admin who is no longer in ADMIN_EMAILS', async () => {
    const { staffService } = setup()
    const row = await staffService.signIn({ email: 'former@example.com', sub: 'g-former' })
    expect(row.role).toBe('staff')
  })

  it('promotes an existing staff row whose email is now in ADMIN_EMAILS', async () => {
    const { staffService, staffRepo } = setup()
    staffRepo.rows.push({ id: 9, name: 'D', email: 'deputy@example.com', role: 'staff', active: 1, google_sub: null })
    expect((await staffService.signIn({ email: 'deputy@example.com', sub: 'g-d' })).role).toBe('admin')
  })
})

describe('staff management', () => {
  it('adds staff with a lowercase email and role staff', async () => {
    const { staffService } = setup()
    const created = await staffService.create({ name: 'Meena', email: 'Meena@Example.com' })
    expect(created).toMatchObject({ email: 'meena@example.com', isAdmin: false, active: true })
  })

  it('reports a duplicate email as 409', async () => {
    const { staffService } = setup()
    await expect(staffService.create({ name: 'A', email: 'asha@example.com' })).rejects.toMatchObject({ status: 409 })
  })

  it('refuses to edit an admin', async () => {
    const { staffService } = setup()
    await expect(staffService.update(1, { active: false })).rejects.toMatchObject({ status: 403 })
  })

  it('clears google_sub when the email changes', async () => {
    const { staffService, staffRepo } = setup()
    staffRepo.rows[1].google_sub = 'g-asha'
    await staffService.update(2, { email: 'asha.new@example.com' })
    expect(staffRepo.rows[1]).toMatchObject({ email: 'asha.new@example.com', google_sub: null })
  })

  it('lists active admins in ADMIN_EMAILS order', async () => {
    const { staffService, staffRepo } = setup()
    staffRepo.rows.unshift({ id: 5, name: 'Deputy', email: 'deputy@example.com', role: 'admin', active: 1 })
    expect(await staffService.listAdmins()).toEqual([{ id: 1, name: 'Boss' }, { id: 5, name: 'Deputy' }])
  })

  it('reports isAdmin from config on every lookup', async () => {
    const { staffService, staffRepo } = setup()
    expect(await staffService.currentUser(4)).toMatchObject({ isAdmin: false })
    expect(await staffService.currentUser(1)).toMatchObject({ isAdmin: true })
    staffRepo.rows[1].active = 0
    expect(await staffService.currentUser(2)).toBeNull()
  })
})
