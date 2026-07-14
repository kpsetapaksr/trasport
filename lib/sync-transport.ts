import { TransportRequest } from './models';
import { getClinicalModels } from './clinical-models';

/**
 * Self-heal transport requests whose linked clinic appointment has been
 * rescheduled. The clinic app updates an appointment in place (same
 * `appointment_id`) but has no hook back into the transport portal, so the
 * transport record keeps the OLD date/time and the shuttle shows the wrong slot.
 *
 * For each transport request that references a clinic appointment (by
 * appointment_id) whose date or time no longer matches, we:
 *   - update appointment_date + appointment_time to the live clinic values, and
 *   - if the DATE changed, flag the booking for staff review: revert status to
 *     'pending' and unassign any vehicle(s), so the pickup/dropoff time and
 *     vehicle capacity are re-confirmed rather than silently kept wrong.
 *
 * Returns the count reconciled. Safe to call on every read — it only writes when
 * an actual mismatch is found. Errors are swallowed per-record so a sync problem
 * never breaks the list/lookup.
 */
export async function reconcileTransportRequests(
    requests: Array<{ _id: any; appointment_id?: string; appointment_date?: any; appointment_time?: string }>
): Promise<number> {
    const withApptId = requests.filter(r => r.appointment_id)
    if (withApptId.length === 0) return 0

    let reconciled = 0
    try {
        const { Appointment } = await getClinicalModels()
        const apptIds = [...new Set(withApptId.map(r => r.appointment_id))]
        const clinicAppts = await Appointment.find({ id: { $in: apptIds } })
            .select('id appointmentDate timeSlot status')
            .lean()
        const apptMap = new Map(clinicAppts.map((a: any) => [a.id, a]))

        for (const req of withApptId) {
            const appt: any = apptMap.get(req.appointment_id as string)
            if (!appt || !appt.appointmentDate) continue

            // Transport stores appointment_date as a Date; derive its YYYY-MM-DD
            // in Malaysia time (bookings are date-scoped in +08:00).
            const stored = req.appointment_date ? new Date(req.appointment_date) : null
            const storedDateStr = stored
                ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(stored)
                : null

            const dateChanged = storedDateStr !== appt.appointmentDate
            const timeChanged = (req.appointment_time || '') !== (appt.timeSlot || '')
            if (!dateChanged && !timeChanged) continue

            const update: any = {
                appointment_date: new Date(`${appt.appointmentDate}T00:00:00+08:00`),
                appointment_time: appt.timeSlot,
            }
            // A date change likely invalidates the pickup/dropoff time and vehicle
            // assignment — flag for staff review instead of keeping a wrong slot.
            if (dateChanged) {
                update.status = 'pending'
                update.vehicle_id = null
                update.dropoff_vehicle_id = null
                update.pickup_status = 'pending'
                update.dropoff_status = 'pending'
                update.status_updated_by = null
                update.status_updated_at = null
            }

            try {
                await TransportRequest.updateOne({ _id: req._id }, { $set: update })
                // Mutate the in-memory object so the current response reflects the fix.
                Object.assign(req, update)
                reconciled++
            } catch {
                // Ignore per-record failures (e.g. unique-index clash on new date);
                // staff can resolve manually and the next sync will retry.
            }
        }
    } catch {
        // Clinical DB unreachable — skip sync, return what we have.
        return reconciled
    }
    return reconciled
}
