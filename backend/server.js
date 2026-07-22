require('./config/env');

const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const { port } = require('./config/env');
const { initSocket } = require('./socket');

require('./config/firebaseAdmin');

connectDB();

const { startReservationExpiryJob } = require("./jobs/reservationExpiryJob");
startReservationExpiryJob();

const { startSellerPlanExpiryJob } = require("./jobs/sellerPlanExpiryJob");
startSellerPlanExpiryJob();

const { startPromotionExpiryJob } = require("./jobs/promotionExpiryJob");
startPromotionExpiryJob();

const server = http.createServer(app);
initSocket(server);

server.listen(port, '0.0.0.0', () => {
  const { isPayosConfigured } = require('./services/payosClient');
  console.log(`Server running on port ${port}`);
  console.log(`PayOS: ${isPayosConfigured() ? 'configured' : 'NOT configured (check FastMark/.env)'}`);
});
