/* Script kiểm tra nhanh dữ liệu dashboard admin (read-only). */
const mongoose = require("mongoose");
const { mongoUri } = require("../config/env");
const { getAdminDashboard } = require("../services/adminDashboardService");

async function main() {
  await mongoose.connect(mongoUri);
  const dashboard = await getAdminDashboard({
    from: process.argv[2] || "2026-07-01",
    to: process.argv[3] || "2026-07-22",
  });
  console.log(
    JSON.stringify(
      {
        range: { from: dashboard.from, to: dashboard.to, days: dashboard.periodDays },
        metrics: dashboard.metrics,
        previousPeriod: dashboard.previousPeriod,
        pending: dashboard.pending,
        escrow: {
          balance: dashboard.cards.escrowBalance,
          count: dashboard.cards.escrowReservationsCount,
        },
        chartSample: {
          users: dashboard.charts.usersOverTime.slice(-5),
          reservations: dashboard.charts.reservationsOverTime.slice(-5),
          revenue: dashboard.charts.revenueOverTime.slice(-5),
        },
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
