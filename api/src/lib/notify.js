// Single entry point for notifications. v1 is in-app only: the admin UI polls
// /api/admin/counts for badges, so the only channel just logs. Add email or
// WhatsApp by appending a channel here; callers never change.

const logChannel = {
  async send(event) {
    console.log(`[notify] ${event.type}: ${event.movementIds.length} movement(s)`, event.movementIds)
  }
}

const channels = [logChannel]

export async function notify(event) {
  await Promise.all(channels.map((channel) => channel.send(event)))
}
