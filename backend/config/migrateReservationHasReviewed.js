/**
 * Backfill Reservation.hasReviewed from any historical review (kể cả đã gỡ).
 * Idempotent — marked via _migrations.reservation_has_reviewed_v1.
 */
async function migrateReservationHasReviewed(connection) {
  const meta = connection.db.collection("_migrations");
  const already = await meta.findOne({ _id: "reservation_has_reviewed_v1" });
  if (already) {
    return { skipped: true };
  }

  const reviews = connection.db.collection("reviews");
  const reservations = connection.db.collection("reservations");

  const reservationIds = await reviews.distinct("reservationId", {
    reservationId: { $exists: true, $ne: null },
  });

  let updated = 0;
  if (reservationIds.length) {
    const result = await reservations.updateMany(
      { _id: { $in: reservationIds }, hasReviewed: { $ne: true } },
      { $set: { hasReviewed: true } }
    );
    updated = result.modifiedCount || 0;
  }

  await meta.updateOne(
    { _id: "reservation_has_reviewed_v1" },
    { $set: { at: new Date(), updated } },
    { upsert: true }
  );

  return { updated, reservationIds: reservationIds.length };
}

module.exports = { migrateReservationHasReviewed };
