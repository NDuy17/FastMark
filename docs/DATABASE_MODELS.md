# FastMark — Tài liệu Models (MongoDB / Mongoose)

> Nguồn: `backend/models/*.js` · Sinh tự động từ schema.
>
> **Ghi chú kiểu dữ liệu:** MongoDB không có `length` cố định như SQL.
> - `ObjectId`: length = 24 (hex)
> - `String`/`Number`/`Date`/`Boolean`: length = `-` trừ khi có min/max/maxlength
>
> **Key:** PK = khóa chính `_id` · UNIQUE · INDEX
>
> **Quan hệ trên field:** `N-1 → Model` = nhiều bản ghi trỏ 1 bản ghi (ref).
> Quan hệ tổng hợp của model nằm ở đầu mỗi mục.

## Mục lục models

| STT | Model | Collection | Số trường | File |
| ---: | --- | --- | ---: | --- |
| 1 | [Bank](#model-bank) | `banks` | 6 | `backend/models/Bank.js` |
| 2 | [Banner](#model-banner) | `banners` | 13 | `backend/models/Banner.js` |
| 3 | [BannerPlan](#model-bannerplan) | `bannerplans` | 7 | `backend/models/BannerPlan.js` |
| 4 | [Conversation](#model-conversation) | `conversations` | 9 | `backend/models/Conversation.js` |
| 5 | [FavoriteProduct](#model-favoriteproduct) | `favoriteproducts` | 5 | `backend/models/FavoriteProduct.js` |
| 6 | [Follow](#model-follow) | `follows` | 5 | `backend/models/Follow.js` |
| 7 | [Message](#model-message) | `messages` | 13 | `backend/models/Message.js` |
| 8 | [Notification](#model-notification) | `notifications` | 8 | `backend/models/Notification.js` |
| 9 | [Product](#model-product) | `products` | 20 | `backend/models/Product.js` |
| 10 | [ProductCategory](#model-productcategory) | `categories` | 8 | `backend/models/ProductCategory.js` |
| 11 | [ProductImage](#model-productimage) | `productimages` | 5 | `backend/models/ProductImage.js` |
| 12 | [ProductVariant](#model-productvariant) | `productvariants` | 10 | `backend/models/ProductVariant.js` |
| 13 | [Report](#model-report) | `reports` | 20 | `backend/models/Report.js` |
| 14 | [ReportImage](#model-reportimage) | `reportimages` | 4 | `backend/models/ReportImage.js` |
| 15 | [Reservation](#model-reservation) | `reservations` | 33 | `backend/models/Reservation.js` |
| 16 | [ReservationAuditLog](#model-reservationauditlog) | `reservationauditlogs` | 7 | `backend/models/ReservationAuditLog.js` |
| 17 | [Review](#model-review) | `reviews` | 12 | `backend/models/Review.js` |
| 18 | [ReviewImage](#model-reviewimage) | `reviewimages` | 5 | `backend/models/ReviewImage.js` |
| 19 | [SellerBannerPlan](#model-sellerbannerplan) | `sellerbannerplans` | 16 | `backend/models/SellerBannerPlan.js` |
| 20 | [SellerPlan](#model-sellerplan) | `sellerplans` | 8 | `backend/models/SellerPlan.js` |
| 21 | [SellerSubscription](#model-sellersubscription) | `sellersubscriptions` | 11 | `backend/models/SellerSubscription.js` |
| 22 | [SellerVerification](#model-sellerverification) | `sellerverifications` | 15 | `backend/models/SellerVerification.js` |
| 23 | [ShopCategory](#model-shopcategory) | `shopcategories` | 6 | `backend/models/ShopCategory.js` |
| 24 | [ShopProfile](#model-shopprofile) | `shopprofiles` | 22 | `backend/models/ShopProfile.js` |
| 25 | [SystemWallet](#model-systemwallet) | `systemwallets` | 5 | `backend/models/SystemWallet.js` |
| 26 | [User](#model-user) | `users` | 17 | `backend/models/User.js` |
| 27 | [Wallet](#model-wallet) | `wallets` | 5 | `backend/models/Wallet.js` |
| 28 | [WalletTransaction](#model-wallettransaction) | `wallettransactions` | 16 | `backend/models/WalletTransaction.js` |
| 29 | [WithdrawRequest](#model-withdrawrequest) | `withdrawrequests` | 16 | `backend/models/WithdrawRequest.js` |

## Model: Bank

- **STT model:** 1
- **Collection:** `banks`
- **File:** `backend/models/Bank.js`
- **Index compound:** `isActive`, `code UNIQUE`
- **Quan hệ tổng hợp:**
  - 1-N → WithdrawRequest (tham chiếu mã ngân hàng)

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `code` | String | - | YES | INDEX | trim | - |
| 5 | `isActive` | Boolean | - | NO | INDEX | default: true | - |
| 6 | `name` | String | - | YES | - | trim | - |

## Model: Banner

- **STT model:** 2
- **Collection:** `banners`
- **File:** `backend/models/Banner.js`
- **Index compound:** `shopId`, `status`
- **Quan hệ tổng hợp:**
  - N-1 → ShopProfile (shopId, optional)

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `description` | String | - | NO | - | default: "" | - |
| 5 | `endDate` | Date | - | NO | - | default: null | - |
| 6 | `image` | String | - | NO | - | default: "" | - |
| 7 | `priority` | Number | - | NO | - | default: 0 | - |
| 8 | `shopId` | ObjectId | 24 | NO | INDEX | default: null | N-1 → ShopProfile |
| 9 | `startDate` | Date | - | NO | - | default: null | - |
| 10 | `status` | Number | - | NO | INDEX | default: 1; enum: [0,1] | - |
| 11 | `targetId` | String | - | NO | - | default: "" | - |
| 12 | `targetType` | Number | - | NO | - | default: 4; enum: [1,2,3,4] | - |
| 13 | `title` | String | - | YES | - | trim | - |

## Model: BannerPlan

- **STT model:** 3
- **Collection:** `bannerplans`
- **File:** `backend/models/BannerPlan.js`
- **Index compound:** `isActive`
- **Quan hệ tổng hợp:**
  - 1-N → SellerBannerPlan

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `durationDays` | Number | - | YES | - | min:1 | - |
| 5 | `isActive` | Boolean | - | NO | INDEX | default: true | - |
| 6 | `name` | String | - | YES | - | trim | - |
| 7 | `price` | Number | - | YES | - | min:0 | - |

## Model: Conversation

- **STT model:** 4
- **Collection:** `conversations`
- **File:** `backend/models/Conversation.js`
- **Index compound:** `participantA`, `participantB`, `contextShopId`, `participantA,participantB UNIQUE`
- **Quan hệ tổng hợp:**
  - N-1 → User (participantA)
  - N-1 → User (participantB)
  - N-1 → ShopProfile (contextShopId, optional)
  - 1-N → Message

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `contextShopId` | ObjectId | 24 | NO | INDEX | default: null | N-1 → ShopProfile |
| 5 | `lastMessage` | String | - | NO | - | - | - |
| 6 | `lastMessageAt` | Date | - | NO | - | - | - |
| 7 | `nextThuTu` | Number | - | NO | - | default: 0 | - |
| 8 | `participantA` | ObjectId | 24 | YES | INDEX | - | N-1 → User |
| 9 | `participantB` | ObjectId | 24 | YES | INDEX | - | N-1 → User |

## Model: FavoriteProduct

- **STT model:** 5
- **Collection:** `favoriteproducts`
- **File:** `backend/models/FavoriteProduct.js`
- **Index compound:** `userId`, `productId`, `userId,productId UNIQUE`
- **Quan hệ tổng hợp:**
  - N-1 → User; N-1 → Product (bảng nối N-N User↔Product)

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `productId` | ObjectId | 24 | YES | INDEX | - | N-1 → Product |
| 5 | `userId` | ObjectId | 24 | YES | INDEX | - | N-1 → User |

## Model: Follow

- **STT model:** 6
- **Collection:** `follows`
- **File:** `backend/models/Follow.js`
- **Index compound:** `followerId`, `followedUserId`, `followerId,followedUserId UNIQUE`, `followedUserId,CreatedAt`, `followerId,CreatedAt`
- **Quan hệ tổng hợp:**
  - N-1 → User (follower); N-1 → User (following) — N-N User↔User

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | INDEX | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `followedUserId` | ObjectId | 24 | YES | INDEX | - | N-1 → User |
| 5 | `followerId` | ObjectId | 24 | YES | INDEX | - | N-1 → User |

## Model: Message

- **STT model:** 7
- **Collection:** `messages`
- **File:** `backend/models/Message.js`
- **Index compound:** `conversationId`, `senderId`, `senderType`, `ThuTu`, `conversationId,ThuTu`
- **Quan hệ tổng hợp:**
  - N-1 → Conversation; N-1 → User (sender)

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `DeletedAt` | Date | - | NO | - | default: null | - |
| 4 | `ThuTu` | Number | - | NO | INDEX | default: 0 | - |
| 5 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 6 | `content` | String | - | NO | - | default: "" | - |
| 7 | `conversationId` | ObjectId | 24 | NO | INDEX | - | N-1 → Conversation |
| 8 | `imageUrl` | String | - | NO | - | default: "" | - |
| 9 | `isRead` | Number | - | NO | - | default: 0 | - |
| 10 | `messageStatus` | Number | - | NO | - | default: 0 | - |
| 11 | `messageType` | Number | - | NO | - | default: 0 | - |
| 12 | `senderId` | ObjectId | 24 | NO | INDEX | - | N-1 → User |
| 13 | `senderType` | Number | - | NO | INDEX | default: 0 | - |

## Model: Notification

- **STT model:** 8
- **Collection:** `notifications`
- **File:** `backend/models/Notification.js`
- **Index compound:** `userId`, `audience`, `userId,audience,CreatedAt`
- **Quan hệ tổng hợp:**
  - N-1 → User

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | INDEX | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `audience` | String | - | NO | INDEX | default: "system"; enum: ["buyer","seller","system"] | - |
| 5 | `content` | String | - | NO | - | - | - |
| 6 | `isRead` | Number | - | NO | - | default: 0 | - |
| 7 | `title` | String | - | NO | - | - | - |
| 8 | `userId` | ObjectId | 24 | NO | INDEX | - | N-1 → User |

## Model: Product

- **STT model:** 9
- **Collection:** `products`
- **File:** `backend/models/Product.js`
- **Index compound:** `ShopId`, `CategoryId`, `Status`, `IsPromotion`, `PromotionStartDate`, `PromotionEndDate`, `IsPromotion,DiscountPercent,PromotionEndDate`
- **Quan hệ tổng hợp:**
  - N-1 → ShopProfile (ShopId)
  - N-1 → ProductCategory (CategoryId)
  - 1-N → ProductVariant, ProductImage, FavoriteProduct, Review

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CategoryId` | ObjectId | 24 | YES | INDEX | - | N-1 → ProductCategory |
| 3 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `Description` | String | - | NO | - | default: "" | - |
| 5 | `DiscountPercent` | Number | 0..100 | NO | INDEX | default: 0; min:0; max:100 | - |
| 6 | `DonVi` | String | - | NO | - | default: ""; trim | - |
| 7 | `IsPromotion` | Boolean | - | NO | INDEX | default: false | - |
| 8 | `LikeCount` | Number | - | NO | - | default: 0 | - |
| 9 | `MaxPrice` | Number | - | NO | - | default: 0 | - |
| 10 | `MinPrice` | Number | - | NO | - | default: 0 | - |
| 11 | `OriginalPrice` | Number | - | NO | - | default: 0 | - |
| 12 | `ProductName` | String | - | YES | - | trim | - |
| 13 | `PromotionEndDate` | Date | - | NO | INDEX | default: null | - |
| 14 | `PromotionPrice` | Number | - | NO | - | default: null | - |
| 15 | `PromotionStartDate` | Date | - | NO | INDEX | default: null | - |
| 16 | `ShopId` | ObjectId | 24 | YES | INDEX | - | N-1 → ShopProfile |
| 17 | `SoldCount` | Number | - | NO | - | default: 0 | - |
| 18 | `Status` | Number | - | NO | INDEX | default: 1 | - |
| 19 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 20 | `ViewCount` | Number | - | NO | - | default: 0 | - |

## Model: ProductCategory

- **STT model:** 10
- **Collection:** `categories`
- **File:** `backend/models/ProductCategory.js`
- **Index compound:** `name UNIQUE`
- **Quan hệ tổng hợp:**
  - 1-N → Product

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `IsDeleted` | Number | - | NO | - | default: 1 | - |
| 4 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 5 | `categoryName` | String | - | NO | - | trim | - |
| 6 | `description` | String | - | NO | - | - | - |
| 7 | `icon` | String | - | NO | - | - | - |
| 8 | `name` | String | - | YES | UNIQUE, INDEX | trim | - |

## Model: ProductImage

- **STT model:** 11
- **Collection:** `productimages`
- **File:** `backend/models/ProductImage.js`
- **Index compound:** `ProductId`, `Stt`, `ProductId,Stt`
- **Quan hệ tổng hợp:**
  - N-1 → Product (productId)

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `ImageUrl` | String | - | YES | - | trim | - |
| 3 | `ProductId` | ObjectId | 24 | YES | INDEX | - | N-1 → Product |
| 4 | `Stt` | Number | - | NO | INDEX | default: 0; min:0 | - |
| 5 | `UploadedAt` | Date | - | NO | - | default: fn | - |

## Model: ProductVariant

- **STT model:** 12
- **Collection:** `productvariants`
- **File:** `backend/models/ProductVariant.js`
- **Index compound:** `ProductId`
- **Quan hệ tổng hợp:**
  - N-1 → Product (ProductId)
  - 1-N → Reservation (variantId)

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `ImageUrl` | String | - | NO | - | default: "" | - |
| 4 | `Price` | Number | - | YES | - | min:0 | - |
| 5 | `ProductId` | ObjectId | 24 | YES | INDEX | - | N-1 → Product |
| 6 | `Quantity` | Number | - | YES | - | default: 0; min:0 | - |
| 7 | `SoldCount` | Number | - | NO | - | default: 0; min:0 | - |
| 8 | `Status` | Number | - | NO | - | default: 1 | - |
| 9 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 10 | `VariantName` | String | - | YES | - | trim | - |

## Model: Report

- **STT model:** 13
- **Collection:** `reports`
- **File:** `backend/models/Report.js`
- **Index compound:** `userId`, `shopId`, `reservationId`, `reportType`, `status`, `reservationId,reportType,userId UNIQUE`
- **Quan hệ tổng hợp:**
  - N-1 → User (reporter)
  - N-1 → User/Shop/Product/Reservation (tùy reportType)
  - 1-N → ReportImage

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `adminDecision` | String | - | NO | - | default: "" | - |
| 5 | `adminNote` | String | - | NO | - | default: "" | - |
| 6 | `content` | String | - | NO | - | - | - |
| 7 | `description` | String | - | NO | - | default: "" | - |
| 8 | `latitude` | Number | - | NO | - | default: null | - |
| 9 | `longitude` | Number | - | NO | - | default: null | - |
| 10 | `processedAt` | Date | - | NO | - | - | - |
| 11 | `processedBy` | ObjectId | 24 | NO | - | - | N-1 → User |
| 12 | `productId` | ObjectId | 24 | NO | - | - | N-1 → Product |
| 13 | `reportType` | Number | - | YES | INDEX | - | - |
| 14 | `reservationId` | ObjectId | 24 | NO | INDEX | default: null | N-1 → Reservation |
| 15 | `reviewId` | String | - | NO | - | default: "" | - |
| 16 | `shopId` | ObjectId | 24 | NO | INDEX | - | N-1 → ShopProfile |
| 17 | `status` | Number | - | NO | INDEX | default: 0 | - |
| 18 | `targetUserId` | ObjectId | 24 | NO | - | - | N-1 → User |
| 19 | `title` | String | - | NO | - | - | - |
| 20 | `userId` | ObjectId | 24 | NO | INDEX | - | N-1 → User |

## Model: ReportImage

- **STT model:** 14
- **Collection:** `reportimages`
- **File:** `backend/models/ReportImage.js`
- **Quan hệ tổng hợp:**
  - N-1 → Report

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `imageUrl` | String | - | NO | - | - | - |
| 4 | `reportId` | ObjectId | 24 | NO | - | - | N-1 → Report |

## Model: Reservation

- **STT model:** 15
- **Collection:** `reservations`
- **File:** `backend/models/Reservation.js`
- **Index compound:** `shopId`, `userId`, `pickupTime`, `status`, `reviewDeadlineAt`, `autoReleaseAt`
- **Quan hệ tổng hợp:**
  - N-1 → User (buyer)
  - N-1 → ShopProfile, Product, ProductVariant
  - 1-0..N → Report (tranh chấp), ReservationAuditLog
  - 1-0..N → WalletTransaction (cọc)

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `autoReleaseAt` | Date | - | NO | INDEX | default: null | - |
| 5 | `cancelReason` | String | - | NO | - | - | - |
| 6 | `cancelledAt` | Date | - | NO | - | - | - |
| 7 | `completedAt` | Date | - | NO | - | default: null | - |
| 8 | `depositAmount` | Number | - | NO | - | default: 0 | - |
| 9 | `depositHoldTxnId` | ObjectId | 24 | NO | - | default: null | N-1 → WalletTransaction |
| 10 | `depositPaidAt` | Date | - | NO | - | default: null | - |
| 11 | `depositPercent` | Number | - | NO | - | default: 0 | - |
| 12 | `depositRefundTxnId` | ObjectId | 24 | NO | - | default: null | N-1 → WalletTransaction |
| 13 | `depositRefundedAt` | Date | - | NO | - | default: null | - |
| 14 | `depositReleasedAt` | Date | - | NO | - | default: null | - |
| 15 | `depositReleasedTxnId` | ObjectId | 24 | NO | - | default: null | N-1 → WalletTransaction |
| 16 | `depositRequired` | Boolean | - | NO | - | default: false | - |
| 17 | `disputeByBuyer` | Boolean | - | NO | - | default: false | - |
| 18 | `disputeBySeller` | Boolean | - | NO | - | default: false | - |
| 19 | `disputeDescription` | String | - | NO | - | default: "" | - |
| 20 | `disputeReason` | String | - | NO | - | default: "" | - |
| 21 | `disputedAt` | Date | - | NO | - | default: null | - |
| 22 | `inventoryHeld` | Boolean | - | NO | - | default: false | - |
| 23 | `note` | String | - | NO | - | - | - |
| 24 | `pickupTime` | Date | - | NO | INDEX | - | - |
| 25 | `productId` | ObjectId | 24 | NO | - | - | N-1 → Product |
| 26 | `quantity` | Number | - | NO | - | - | - |
| 27 | `reservedPrice` | Number | - | NO | - | - | - |
| 28 | `reviewDeadlineAt` | Date | - | NO | INDEX | default: null | - |
| 29 | `sellerConfirmedAt` | Date | - | NO | - | default: null | - |
| 30 | `shopId` | ObjectId | 24 | NO | INDEX | - | N-1 → ShopProfile |
| 31 | `status` | Number | - | NO | INDEX | default: 0 | - |
| 32 | `userId` | ObjectId | 24 | NO | INDEX | - | N-1 → User |
| 33 | `variantId` | ObjectId | 24 | NO | - | - | N-1 → ProductVariant |

## Model: ReservationAuditLog

- **STT model:** 16
- **Collection:** `reservationauditlogs`
- **File:** `backend/models/ReservationAuditLog.js`
- **Index compound:** `adminId`, `reservationId`, `action`
- **Quan hệ tổng hợp:**
  - N-1 → Reservation; N-1 → User (admin)

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `action` | String | - | YES | INDEX | - | - |
| 4 | `adminId` | ObjectId | 24 | YES | INDEX | - | N-1 → User |
| 5 | `decision` | String | - | NO | - | default: "" | - |
| 6 | `note` | String | - | NO | - | default: "" | - |
| 7 | `reservationId` | ObjectId | 24 | YES | INDEX | - | N-1 → Reservation |

## Model: Review

- **STT model:** 17
- **Collection:** `reviews`
- **File:** `backend/models/Review.js`
- **Index compound:** `userId`, `shopId`, `productId`, `reservationId`, `isHidden`, `isDeleted`, `shopId,CreatedAt`, `productId,CreatedAt`, `userId,CreatedAt`, `reservationId UNIQUE`
- **Quan hệ tổng hợp:**
  - N-1 → User, Product, ShopProfile, Reservation (optional)
  - 1-N → ReviewImage

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | INDEX | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `comment` | String | - | NO | - | default: "" | - |
| 5 | `deletedAt` | Date | - | NO | - | default: null | - |
| 6 | `isDeleted` | Boolean | - | NO | INDEX | default: false | - |
| 7 | `isHidden` | Boolean | - | NO | INDEX | default: false | - |
| 8 | `productId` | ObjectId | 24 | YES | INDEX | - | N-1 → Product |
| 9 | `rating` | Number | 1..5 | YES | - | min:1; max:5 | - |
| 10 | `reservationId` | ObjectId | 24 | YES | INDEX | - | N-1 → Reservation |
| 11 | `shopId` | ObjectId | 24 | YES | INDEX | - | N-1 → ShopProfile |
| 12 | `userId` | ObjectId | 24 | YES | INDEX | - | N-1 → User |

## Model: ReviewImage

- **STT model:** 18
- **Collection:** `reviewimages`
- **File:** `backend/models/ReviewImage.js`
- **Index compound:** `reviewId`, `Stt`, `reviewId,Stt`
- **Quan hệ tổng hợp:**
  - N-1 → Review

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `ImageUrl` | String | - | YES | - | trim | - |
| 3 | `Stt` | Number | - | NO | INDEX | default: 0; min:0 | - |
| 4 | `UploadedAt` | Date | - | NO | - | default: fn | - |
| 5 | `reviewId` | ObjectId | 24 | YES | INDEX | - | N-1 → Review |

## Model: SellerBannerPlan

- **STT model:** 19
- **Collection:** `sellerbannerplans`
- **File:** `backend/models/SellerBannerPlan.js`
- **Index compound:** `sellerId`, `shopId`, `planId`, `endDate`, `status`, `shopId,status,endDate`, `status,endDate,CreatedAt`
- **Quan hệ tổng hợp:**
  - N-1 → User, ShopProfile, BannerPlan

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | INDEX | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `amount` | Number | - | YES | - | min:0 | - |
| 5 | `description` | String | - | NO | - | default: "" | - |
| 6 | `endDate` | Date | - | YES | INDEX | - | - |
| 7 | `image` | String | - | NO | - | default: "" | - |
| 8 | `planId` | ObjectId | 24 | YES | INDEX | - | N-1 → BannerPlan |
| 9 | `planName` | String | - | NO | - | default: "" | - |
| 10 | `sellerId` | ObjectId | 24 | YES | INDEX | - | N-1 → User |
| 11 | `shopId` | ObjectId | 24 | YES | INDEX | - | N-1 → ShopProfile |
| 12 | `startDate` | Date | - | YES | - | - | - |
| 13 | `status` | Number | - | NO | INDEX | default: 0; enum: [0,1,2,3] | - |
| 14 | `targetId` | String | - | NO | - | default: "" | - |
| 15 | `targetType` | Number | - | NO | - | default: 2; enum: [1,2,3,4] | - |
| 16 | `title` | String | - | NO | - | default: ""; trim | - |

## Model: SellerPlan

- **STT model:** 20
- **Collection:** `sellerplans`
- **File:** `backend/models/SellerPlan.js`
- **Index compound:** `isActive`
- **Quan hệ tổng hợp:**
  - 1-N → SellerSubscription

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `description` | String | - | NO | - | default: ""; trim | - |
| 5 | `durationDays` | Number | - | YES | - | min:1 | - |
| 6 | `isActive` | Boolean | - | NO | INDEX | default: true | - |
| 7 | `name` | String | - | YES | - | trim | - |
| 8 | `price` | Number | - | YES | - | min:0 | - |

## Model: SellerSubscription

- **STT model:** 21
- **Collection:** `sellersubscriptions`
- **File:** `backend/models/SellerSubscription.js`
- **Index compound:** `sellerId`, `shopId`, `planId`, `endDate`, `status`, `shopId,status,endDate`, `sellerId,CreatedAt`
- **Quan hệ tổng hợp:**
  - N-1 → User, ShopProfile, SellerPlan

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | INDEX | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `amount` | Number | - | YES | - | min:0 | - |
| 5 | `endDate` | Date | - | YES | INDEX | - | - |
| 6 | `planId` | ObjectId | 24 | YES | INDEX | - | N-1 → SellerPlan |
| 7 | `planName` | String | - | NO | - | default: "" | - |
| 8 | `sellerId` | ObjectId | 24 | YES | INDEX | - | N-1 → User |
| 9 | `shopId` | ObjectId | 24 | YES | INDEX | - | N-1 → ShopProfile |
| 10 | `startDate` | Date | - | YES | - | - | - |
| 11 | `status` | Number | - | NO | INDEX | default: 0; enum: [0,1,2,3] | - |

## Model: SellerVerification

- **STT model:** 22
- **Collection:** `sellerverifications`
- **File:** `backend/models/SellerVerification.js`
- **Index compound:** `userId`, `status`
- **Quan hệ tổng hợp:**
  - N-1 → User (seller); N-1 → User (processedBy)

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `LyDoTuChoi` | String | - | NO | - | default: "" | - |
| 4 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 5 | `address` | String | - | NO | - | default: "" | - |
| 6 | `addressHeThong` | String | - | NO | - | default: "" | - |
| 7 | `approvedBy` | ObjectId | 24 | NO | - | default: null | N-1 → User |
| 8 | `categoryId` | ObjectId | 24 | NO | - | - | N-1 → ShopCategory |
| 9 | `cccdBackImage` | String | - | NO | - | default: "" | - |
| 10 | `cccdFrontImage` | String | - | NO | - | default: "" | - |
| 11 | `latitude` | Number | - | NO | - | default: null | - |
| 12 | `longitude` | Number | - | NO | - | default: null | - |
| 13 | `selfieImage` | String | - | NO | - | default: "" | - |
| 14 | `status` | Number | - | NO | INDEX | default: 0 | - |
| 15 | `userId` | ObjectId | 24 | YES | INDEX | - | N-1 → User |

## Model: ShopCategory

- **STT model:** 23
- **Collection:** `shopcategories`
- **File:** `backend/models/ShopCategory.js`
- **Index compound:** `name UNIQUE`
- **Quan hệ tổng hợp:**
  - 1-N → ShopProfile

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `IsDeleted` | Number | - | NO | - | default: 1 | - |
| 4 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 5 | `description` | String | - | NO | - | - | - |
| 6 | `name` | String | - | YES | UNIQUE, INDEX | trim | - |

## Model: ShopProfile

- **STT model:** 24
- **Collection:** `shopprofiles`
- **File:** `backend/models/ShopProfile.js`
- **Index compound:** `userId`, `isActive`, `qrCodeValue`
- **Quan hệ tổng hợp:**
  - N-1 → User (userId)
  - N-1 → ShopCategory (categoryId)
  - 1-N → Product, Reservation, SellerSubscription, SellerBannerPlan, Review

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `address` | String | - | NO | - | default: "" | - |
| 5 | `addressHeThong` | String | - | NO | - | default: "" | - |
| 6 | `allowReserve` | Boolean | - | NO | - | default: true | - |
| 7 | `averageRating` | Number | - | NO | - | default: 0 | - |
| 8 | `categoryId` | ObjectId | 24 | NO | - | - | N-1 → ShopCategory |
| 9 | `closeTime` | String | - | NO | - | default: "" | - |
| 10 | `cocTien` | Number | 0..100 | NO | - | default: 0; min:0; max:100 | - |
| 11 | `description` | String | - | NO | - | default: "" | - |
| 12 | `isActive` | Boolean | - | NO | INDEX | default: false | - |
| 13 | `isOpen` | Number | - | NO | - | default: 1 | - |
| 14 | `latitude` | Number | - | NO | - | default: null | - |
| 15 | `longitude` | Number | - | NO | - | default: null | - |
| 16 | `openTime` | String | - | NO | - | default: "" | - |
| 17 | `qrCodeValue` | String | - | NO | INDEX | default: "" | - |
| 18 | `soldCount` | Number | - | NO | - | default: 0 | - |
| 19 | `status` | Number | - | NO | - | default: 1 | - |
| 20 | `totalProducts` | Number | - | NO | - | default: 0 | - |
| 21 | `totalReviews` | Number | - | NO | - | default: 0 | - |
| 22 | `userId` | ObjectId | 24 | NO | INDEX | - | N-1 → User |

## Model: SystemWallet

- **STT model:** 25
- **Collection:** `systemwallets`
- **File:** `backend/models/SystemWallet.js`
- **Index compound:** `key UNIQUE`
- **Quan hệ tổng hợp:**
  - 1 (singleton key=system) — escrow cọc giữ hàng

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `balance` | Number | - | NO | - | default: 0; min:0 | - |
| 5 | `key` | String | - | NO | UNIQUE, INDEX | default: "system" | - |

## Model: User

- **STT model:** 26
- **Collection:** `users`
- **File:** `backend/models/User.js`
- **Index compound:** `FirebaseUID UNIQUE`, `UserName UNIQUE`, `Email UNIQUE`, `Phone UNIQUE`
- **Quan hệ tổng hợp:**
  - 1-1 → Wallet (userId)
  - 1-0..1 → ShopProfile (userId)
  - 1-N → Notification, Follow, FavoriteProduct, Reservation, Report, Review, WalletTransaction, WithdrawRequest

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `AuthProvider` | String | - | YES | - | enum: ["email","google"] | - |
| 3 | `Avatar` | String | - | NO | - | default: "" | - |
| 4 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 5 | `DangHoatDong` | Boolean | - | NO | - | default: false | - |
| 6 | `Email` | String | - | NO | UNIQUE, INDEX | trim | - |
| 7 | `FirebaseUID` | String | - | YES | UNIQUE, INDEX | trim | - |
| 8 | `FollowersCount` | Number | - | NO | - | default: 0 | - |
| 9 | `FollowingCount` | Number | - | NO | - | default: 0 | - |
| 10 | `FullName` | String | 50 | YES | - | trim | - |
| 11 | `LanHoatDongCuoi` | Date | - | NO | - | default: null | - |
| 12 | `Phone` | String | 10 | NO | UNIQUE, INDEX | trim | - |
| 13 | `Role` | Number | - | NO | - | default: 1 | - |
| 14 | `Status` | Number | - | NO | - | default: 1 | - |
| 15 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 16 | `UserName` | String | 20 | YES | UNIQUE, INDEX | trim | - |
| 17 | `VerifyAccount` | Boolean | - | NO | - | default: false | - |

## Model: Wallet

- **STT model:** 27
- **Collection:** `wallets`
- **File:** `backend/models/Wallet.js`
- **Index compound:** `userId UNIQUE`
- **Quan hệ tổng hợp:**
  - 1-1 → User (userId)

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `balance` | Number | - | NO | - | default: 0; min:0 | - |
| 5 | `userId` | ObjectId | 24 | YES | UNIQUE, INDEX | - | N-1 → User |

## Model: WalletTransaction

- **STT model:** 28
- **Collection:** `wallettransactions`
- **File:** `backend/models/WalletTransaction.js`
- **Index compound:** `userId`, `type`, `status`, `orderCode UNIQUE`, `reservationId`, `referenceId`, `referenceType`
- **Quan hệ tổng hợp:**
  - N-1 → User; N-1 → Reservation (optional)

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `amount` | Number | - | YES | - | min:1 | - |
| 5 | `balanceAfter` | Number | - | NO | - | default: null | - |
| 6 | `balanceBefore` | Number | - | NO | - | default: null | - |
| 7 | `checkoutUrl` | String | - | NO | - | default: "" | - |
| 8 | `description` | String | - | NO | - | default: "" | - |
| 9 | `orderCode` | Number | - | YES | UNIQUE, INDEX | - | - |
| 10 | `paymentLinkId` | String | - | NO | - | default: "" | - |
| 11 | `referenceId` | ObjectId | 24 | NO | INDEX | default: null | - |
| 12 | `referenceType` | String | - | NO | INDEX | default: "" | - |
| 13 | `reservationId` | ObjectId | 24 | NO | INDEX | default: null | N-1 → Reservation |
| 14 | `status` | Number | - | NO | INDEX | default: 0; enum: [0,1,2,3] | - |
| 15 | `type` | Number | - | YES | INDEX | enum: [1,2,3,4,5,6,7] | - |
| 16 | `userId` | ObjectId | 24 | YES | INDEX | - | N-1 → User |

## Model: WithdrawRequest

- **STT model:** 29
- **Collection:** `withdrawrequests`
- **File:** `backend/models/WithdrawRequest.js`
- **Index compound:** `userId`, `bankId`, `status`
- **Quan hệ tổng hợp:**
  - N-1 → User; N-1 → Bank (optional)

| STT | Name | Type | Length | NotNull | Key | Ghi chú | Quan hệ |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `_id` | ObjectId | 24 | YES | PK | MongoDB primary key (tự sinh) | - |
| 2 | `CreatedAt` | Date | - | NO | - | default: fn | - |
| 3 | `UpdatedAt` | Date | - | NO | - | default: fn | - |
| 4 | `accountName` | String | - | YES | - | trim | - |
| 5 | `accountNumber` | String | - | YES | - | trim | - |
| 6 | `adminNote` | String | - | NO | - | default: ""; trim | - |
| 7 | `amount` | Number | - | YES | - | min:1 | - |
| 8 | `bankCode` | String | - | NO | - | default: ""; trim | - |
| 9 | `bankId` | ObjectId | 24 | YES | INDEX | - | N-1 → Bank |
| 10 | `bankName` | String | - | YES | - | trim | - |
| 11 | `processedAt` | Date | - | NO | - | default: null | - |
| 12 | `processedBy` | ObjectId | 24 | NO | - | default: null | N-1 → User |
| 13 | `refundTransactionId` | ObjectId | 24 | NO | - | default: null | N-1 → WalletTransaction |
| 14 | `status` | Number | - | NO | INDEX | default: 0; enum: [0,1,2] | - |
| 15 | `userId` | ObjectId | 24 | YES | INDEX | - | N-1 → User |
| 16 | `walletTransactionId` | ObjectId | 24 | NO | - | default: null | N-1 → WalletTransaction |

## Sơ đồ quan hệ chính (tóm tắt)

```
User 1──1 Wallet
User 1──0..1 ShopProfile N──1 ShopCategory
ShopProfile 1──N Product N──1 ProductCategory
Product 1──N ProductVariant | ProductImage
User N──N Product (FavoriteProduct)
User N──N User (Follow)
User + Shop + Product + Variant → Reservation
Reservation 1──0..N Report 1──N ReportImage
Reservation ↔ WalletTransaction (cọc SystemWallet)
User ↔ User Conversation 1──N Message
SellerPlan 1──N SellerSubscription → ShopProfile
BannerPlan 1──N SellerBannerPlan → ShopProfile
```
