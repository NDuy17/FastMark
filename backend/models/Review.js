const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
    reservationId:{type:mongoose.Schema.Types.ObjectId,ref:"Reservation"},
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
    shopId:{type:mongoose.Schema.Types.ObjectId,ref:"ShopProfile"},

    rating:Number,
    comment:String,

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("Review",ReviewSchema);