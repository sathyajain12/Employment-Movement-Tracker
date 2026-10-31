import { adminEmails, isAdminEmail } from '../lib/admins.js'
import { createAuditRepo } from '../repo/auditRepo.js'
import { createMovementRepo } from '../repo/movementRepo.js'
import { createSettingsRepo } from '../repo/settingsRepo.js'
import { createStaffRepo } from '../repo/staffRepo.js'
import { createMovementService } from './movementService.js'
import { createReportService } from './reportService.js'
import { createSettingsService } from './settingsService.js'
import { createStaffService } from './staffService.js'

// Wires repositories to services for one request or one cron run.
export function buildServices(env) {
  const admins = {
    emails: adminEmails(env),
    isAdmin: (email) => isAdminEmail(env, email)
  }

  const auditRepo = createAuditRepo(env.DB)
  const movementRepo = createMovementRepo(env.DB, auditRepo)
  const staffRepo = createStaffRepo(env.DB)
  const settingsRepo = createSettingsRepo(env.DB)

  const settings = createSettingsService({ settingsRepo })
  return {
    settings,
    staff: createStaffService({ staffRepo, admins }),
    movements: createMovementService({ movementRepo, staffRepo, auditRepo, settingsService: settings, admins }),
    reports: createReportService({ movementRepo, settingsService: settings })
  }
}
