const mongoose = require("mongoose");

/**
 * @deprecated User→user follow đã thay bằng ShopFollow (user→shop).
 * Giữ file để tránh import cũ crash; không dùng tiếp.
 */
module.exports = require("./ShopFollow");
