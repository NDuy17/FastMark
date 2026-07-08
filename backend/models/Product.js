const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
    shopId:{type:mongoose.Schema.Types.ObjectId,ref:"ShopProfile"},
    categoryId:{type:mongoose.Schema.Types.ObjectId,ref:"Category"},

    productName:{type:String,required:true},
    description:String,

    donVi:String,
    thumbnail:String,

    minPrice:Number,
    maxPrice:Number,

    status:{type:Number,default:1},

    viewCount:{type:Number,default:0},
    likeCount:{type:Number,default:0},

    CreatedAt:{type:Date,default:Date.now},
    UpdatedAt:{type:Date,default:Date.now}
});

module.exports = mongoose.model("Product",ProductSchema);