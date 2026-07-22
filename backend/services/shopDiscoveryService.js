const mongoose = require("mongoose");
const ShopProfile = require("../models/ShopProfile");
const { getShopCategoryNameMap } = require("./shopCategoryService");
const User = require("../models/User");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const {
  loadProductImagesByProductIds,
  toPublicProductImages,
} = require("./productService");
const Review = require("../models/Review");
const { USER_ROLE } = require("../constants");
const { PRODUCT_STATUS } = require("../constants");
const {
  isSubscriptionActive,
  activeSubscriptionFilter,
} = require("../constants");
const { removeVietnameseDiacritics } = require("../utils/sanitizeFileName");

const EARTH_RADIUS_METERS = 6371000;
const MAX_SEARCH_RADIUS_METERS = 30000;

function isUnlimitedRadius(radiusMeters) {
  const raw = String(radiusMeters ?? "")
    .trim()
    .toLowerCase();
  if (!raw) {
    return false;
  }
  if (raw === "all" || raw === "unlimited" || raw === "inf" || raw === "infinity") {
    return true;
  }
  const value = Number(radiusMeters);
  return value === 0 || value === -1;
}

function clampSearchRadius(radiusMeters, fallback = 2000) {
  return Math.min(Math.max(Number(radiusMeters) || fallback, 100), MAX_SEARCH_RADIUS_METERS);
}

/** Returns finite radius meters, or null when search should include all distances. */
function resolveSearchRadius(radiusMeters, fallback = 2000) {
  if (isUnlimitedRadius(radiusMeters)) {
    return null;
  }
  return clampSearchRadius(radiusMeters, fallback);
}

function computeIsOutOfStock(variants = []) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return false;
  }

  return computeRemainingQuantity(variants) <= 0;
}

function computeRemainingQuantity(variants = []) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return 0;
  }

  return variants.reduce(
    (sum, variant) => sum + Math.max(0, Number(variant.Quantity ?? variant.quantity ?? 0)),
    0
  );
}

function toListVariants(variants = []) {
  return variants.map((variant) => ({
    id: String(variant._id || variant.id || ""),
    quantity: Math.max(0, Number(variant.Quantity ?? variant.quantity ?? 0)),
  }));
}

function resolveProductGallery(product, imageDocs = []) {
  const fromImages = toPublicProductImages(imageDocs).map((image) => image.imageUrl);
  if (fromImages.length > 0) {
    return fromImages;
  }
  if (Array.isArray(product.Thumbnail)) {
    return product.Thumbnail.filter(Boolean);
  }
  return product.Thumbnail ? [product.Thumbnail] : [];
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lng2 - lng1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function activeProductFilter(extra = {}) {
  return {
    ...extra,
    $or: [
      { Status: PRODUCT_STATUS.ACTIVE },
      { Status: { $exists: false }, IsDeleted: { $ne: true } },
    ],
  };
}

function normalizeSearchText(value) {
  return removeVietnameseDiacritics(String(value || ""))
    .trim()
    .toLowerCase();
}

function textMatchesKeyword(haystackValue, keyword) {
  const haystack = normalizeSearchText(haystackValue);
  const needle = normalizeSearchText(keyword);
  if (!needle) {
    return true;
  }
  if (!haystack) {
    return false;
  }
  return haystack.includes(needle);
}

function shopMatchesKeyword(shop, seller, keyword) {
  if (!keyword) {
    return true;
  }

  const haystack = [
    shop.shopName,
    shop.shopUsername,
    shop.description,
    shop.addressHeThong,
    shop.address,
    seller?.FullName,
    seller?.UserName,
  ]
    .map(normalizeSearchText)
    .filter(Boolean);

  return haystack.some((text) => text.includes(keyword));
}

/**
 * Match người dùng/gian hàng theo:
 * - tên (FullName / shopName) — bỏ dấu + lowercase
 * - username (UserName / shopUsername), có hoặc không có @
 */
function shopMatchesNameOrUsername(shop, seller, keyword) {
  if (!keyword) {
    return true;
  }

  const normalizedKeyword = normalizeSearchText(String(keyword || "").replace(/^@+/, ""));
  if (!normalizedKeyword) {
    return true;
  }

  const haystack = [
    seller?.FullName,
    seller?.UserName,
    shop.shopName,
    shop.shopUsername,
  ]
    .map(normalizeSearchText)
    .filter(Boolean);

  return haystack.some((text) => text.includes(normalizedKeyword));
}

async function findProductMatchesByShopId(keyword, categoryId = "") {
  const productKeyword = normalizeSearchText(keyword);
  const normalizedCategoryId = String(categoryId || "").trim();

  if (!productKeyword && !normalizedCategoryId) {
    return null;
  }

  const productFilter = activeProductFilter();
  if (normalizedCategoryId) {
    productFilter.CategoryId = normalizedCategoryId;
  }

  const matchingProducts = await Product.find(productFilter)
    .select("ShopId ProductName CategoryId")
    .lean();

  const productMatchesByShopId = new Map();
  for (const product of matchingProducts) {
    if (productKeyword && !textMatchesKeyword(product.ProductName, productKeyword)) {
      continue;
    }
    const shopId = String(product.ShopId);
    if (!productMatchesByShopId.has(shopId)) {
      productMatchesByShopId.set(shopId, []);
    }
    const bucket = productMatchesByShopId.get(shopId);
    if (bucket.length < 5) {
      bucket.push(product.ProductName || "");
    }
  }

  return productMatchesByShopId;
}

function mergeProductMatches(...maps) {
  const merged = new Map();

  maps.forEach((map) => {
    if (!map) {
      return;
    }

    map.forEach((products, shopId) => {
      if (!merged.has(shopId)) {
        merged.set(shopId, []);
      }
      const bucket = merged.get(shopId);
      products.forEach((name) => {
        if (name && bucket.length < 5 && !bucket.includes(name)) {
          bucket.push(name);
        }
      });
    });
  });

  return merged.size > 0 ? merged : null;
}

function pickShopText(shop, ...keys) {
  for (const key of keys) {
    const value = shop?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function pickString(value) {
  return String(value || "").trim();
}

function resolveShopCategory(categoryMap, categoryId) {
  const entry = categoryMap.get(String(categoryId));
  if (!entry) {
    return { name: "" };
  }
  if (typeof entry === "string") {
    return { name: entry };
  }
  return {
    name: entry.name || "",
  };
}

function toPublicStore(
  shop,
  user,
  productCount,
  distanceMeters,
  categoryName = "",
  followCount = 0,
  totalLikes = 0
) {
  // Một identity: tên / @ lấy từ User (buyer), shop chỉ là storefront.
  const ownerName = pickString(user?.FullName) || pickString(user?.UserName) || "";
  const ownerUsername = pickString(user?.UserName) || "";
  const shopDisplayName =
    ownerName ||
    shop.shopName ||
    (shop.shopUsername ? `@${shop.shopUsername}` : "") ||
    "Gian hàng Fastmark";

  const systemAddress = pickShopText(
    shop,
    "addressHeThong",
    "DiaChiHeThong",
    "DiachiHethong",
    "systemAddress",
    "system_address"
  );
  const openTime = pickShopText(shop, "openTime", "open_time");
  const closeTime = pickShopText(shop, "closeTime", "close_time");
  const shopUsername = ownerUsername || pickShopText(shop, "shopUsername", "shop_username");
  const pinHours = Boolean(shop.pinHours);
  // Hiện giờ công khai khi shop đã có giờ mở/đóng cửa.
  const showHours = Boolean(openTime && closeTime);
  const ownerFollowers =
    Number(user?.FollowersCount) || Number(followCount) || Number(shop.followersCount) || 0;
  const depositPercent = Math.max(
    0,
    Math.min(100, Number(shop.cocTien ?? shop.depositPercent) || 0)
  );

  return {
    id: String(shop._id),
    name: shopDisplayName,
    shop_name: shopDisplayName,
    shopName: shopDisplayName,
    shop_username: shopUsername,
    shopUsername,
    fullName: ownerName || shopDisplayName,
    userName: shopUsername,
    categoryId: shop.categoryId ? String(shop.categoryId) : "",
    categoryName,
    type: "shop",
    latitude: shop.latitude,
    longitude: shop.longitude,
    address: systemAddress || pickShopText(shop, "address"),
    system_address: systemAddress,
    systemAddress,
    addressHeThong: systemAddress,
    phone: user?.Phone || "",
    zalo: user?.Phone || "",
    intro: pickShopText(shop, "description") || "",
    open_time: showHours ? openTime : "",
    openTime: showHours ? openTime : "",
    close_time: showHours ? closeTime : "",
    closeTime: showHours ? closeTime : "",
    pinHours,
    is_open: Number(shop.isOpen) === 1,
    isOpen: Number(shop.isOpen) === 1 ? 1 : 0,
    rating_avg: Number(shop.averageRating) || 0,
    review_count: Number(shop.totalReviews) || 0,
    follow_count: ownerFollowers,
    product_count: Number(shop.totalProducts) || Number(productCount) || 0,
    total_products: Number(shop.totalProducts) || Number(productCount) || 0,
    sold_count: Number(shop.soldCount) || 0,
    total_likes: Number(totalLikes) || 0,
    owner_user_id: shop.userId ? String(shop.userId) : "",
    ownerUserId: shop.userId ? String(shop.userId) : "",
    image_url: user?.Avatar || "",
    cover_image_url: user?.Avatar || "",
    distance_meters: Math.round(distanceMeters),
    is_registered_shop: true,
    depositPercent,
    cocTien: depositPercent,
    subscriptionActive: true,
  };
}

async function listNearbyShops({ latitude, longitude, radiusMeters = 2000, limit = 50 }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = resolveSearchRadius(radiusMeters, 2000);
  const maxResults = Math.min(Math.max(Number(limit) || 50, 1), 100);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error("Thiếu tọa độ hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const shops = await ShopProfile.find({
    latitude: { $ne: null },
    longitude: { $ne: null },
    status: { $ne: 0 },
    ...activeSubscriptionFilter(),
  }).lean();

  const sellerIds = shops
    .map((shop) => shop.userId)
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  const sellers = await User.find({
    _id: { $in: sellerIds },
    Role: USER_ROLE.SELLER,
  }).lean();
  const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller]));
  const categoryNameMap = await getShopCategoryNameMap(shops.map((shop) => shop.categoryId));

  const nearby = [];

  for (const shop of shops) {
    if (!Number.isFinite(Number(shop.latitude)) || !Number.isFinite(Number(shop.longitude))) {
      continue;
    }

    const seller = sellerMap.get(String(shop.userId));
    if (!seller) {
      continue;
    }

    const distanceMeters = calculateDistanceMeters(
      lat,
      lng,
      Number(shop.latitude),
      Number(shop.longitude)
    );

    if (radius != null && distanceMeters > radius) {
      continue;
    }

    const productCount = await Product.countDocuments(
      activeProductFilter({ ShopId: shop._id })
    );

    nearby.push({
      shop,
      seller,
      productCount,
      distanceMeters,
    });
  }

  nearby.sort((left, right) => left.distanceMeters - right.distanceMeters);

  return nearby.slice(0, maxResults).map(({ shop, seller, productCount, distanceMeters }) => {
    const category = resolveShopCategory(categoryNameMap, shop.categoryId);
    return toPublicStore(
      shop,
      seller,
      productCount,
      distanceMeters,
      category.name,
      0
    );
  });
}

async function searchShops({
  latitude,
  longitude,
  radiusMeters = 2000,
  limit = 50,
  q = "",
  shopCategoryId = "",
  productCategoryId = "",
  productQuery = "",
  identityOnly = false,
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = resolveSearchRadius(radiusMeters, 2000);
  const maxResults = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const shopKeyword = normalizeSearchText(String(q || "").replace(/^@+/, ""));
  const productKeyword = identityOnly ? "" : normalizeSearchText(productQuery);
  const normalizedShopCategoryId = String(shopCategoryId || "").trim();
  const normalizedProductCategoryId = identityOnly
    ? ""
    : String(productCategoryId || "").trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error("Thiếu tọa độ hợp lệ để tìm theo khoảng cách.");
    error.statusCode = 400;
    throw error;
  }

  const shops = await ShopProfile.find({
    latitude: { $ne: null },
    longitude: { $ne: null },
    status: { $ne: 0 },
    ...activeSubscriptionFilter(),
  }).lean();

  const sellerIds = shops
    .map((shop) => shop.userId)
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  const sellers = await User.find({
    _id: { $in: sellerIds },
    Role: USER_ROLE.SELLER,
  }).lean();
  const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller]));
  const categoryNameMap = await getShopCategoryNameMap(shops.map((shop) => shop.categoryId));

  let productMatchesByShopId = null;
  if (!identityOnly) {
    const [productMatchesFromProductQuery, productMatchesFromShopQuery] = await Promise.all([
      findProductMatchesByShopId(productKeyword, normalizedProductCategoryId),
      shopKeyword && !productKeyword
        ? findProductMatchesByShopId(shopKeyword, "")
        : Promise.resolve(null),
    ]);

    productMatchesByShopId = mergeProductMatches(
      productMatchesFromProductQuery,
      productMatchesFromShopQuery
    );
  }

  const results = [];

  for (const shop of shops) {
    if (!Number.isFinite(Number(shop.latitude)) || !Number.isFinite(Number(shop.longitude))) {
      continue;
    }

    const seller = sellerMap.get(String(shop.userId));
    if (!seller) {
      continue;
    }

    const distanceMeters = calculateDistanceMeters(
      lat,
      lng,
      Number(shop.latitude),
      Number(shop.longitude)
    );

    if (radius != null && distanceMeters > radius) {
      continue;
    }

    if (normalizedShopCategoryId && String(shop.categoryId || "") !== normalizedShopCategoryId) {
      continue;
    }

    if (identityOnly) {
      if (shopKeyword && !shopMatchesNameOrUsername(shop, seller, shopKeyword)) {
        continue;
      }
      results.push({
        shop,
        seller,
        distanceMeters,
        matchedProducts: [],
      });
      continue;
    }

    const matchedProducts = productMatchesByShopId?.get(String(shop._id)) || [];
    const matchesShopName = shopMatchesKeyword(shop, seller, shopKeyword);
    const matchesProductName = matchedProducts.length > 0;

    if (shopKeyword) {
      if (productKeyword) {
        if (!matchesShopName) {
          continue;
        }
        if (!matchesProductName) {
          continue;
        }
      } else if (!matchesShopName && !matchesProductName) {
        continue;
      }
    } else if (productKeyword && !matchesProductName) {
      continue;
    } else if (normalizedProductCategoryId && !matchesProductName) {
      continue;
    }

    results.push({
      shop,
      seller,
      distanceMeters,
      matchedProducts,
    });
  }

  results.sort((left, right) => {
    if (left.distanceMeters !== right.distanceMeters) {
      return left.distanceMeters - right.distanceMeters;
    }
    return (left.shop.shopName || "").localeCompare(right.shop.shopName || "", "vi");
  });

  const sliced = results.slice(0, maxResults);
  const productCounts = await Promise.all(
    sliced.map(({ shop }) =>
      Product.countDocuments(activeProductFilter({ ShopId: shop._id }))
    )
  );

  return sliced.map(({ shop, seller, distanceMeters, matchedProducts }, index) => {
    const category = resolveShopCategory(categoryNameMap, shop.categoryId);
    const store = toPublicStore(
      shop,
      seller,
      productCounts[index],
      distanceMeters,
      category.name,
      0
    );
    return {
      ...store,
      matched_products: matchedProducts,
      match_score: Math.round(distanceMeters),
    };
  });
}

async function getPublicShopById(shopId, { latitude, longitude } = {}) {
  const shop = await ShopProfile.findById(shopId).lean();
  if (!shop || !isSubscriptionActive(shop)) {
    const error = new Error("Không tìm thấy gian hàng.");
    error.statusCode = 404;
    throw error;
  }

  const seller = await User.findOne({
    _id: shop.userId,
    Role: USER_ROLE.SELLER,
  }).lean();

  if (!seller) {
    const error = new Error("Không tìm thấy gian hàng.");
    error.statusCode = 404;
    throw error;
  }

  const productCount = await Product.countDocuments(activeProductFilter({ ShopId: shop._id }));
  const categoryNameMap = await getShopCategoryNameMap([shop.categoryId]);
  const followCount = Number(shop.followersCount) || 0;
  const likeAgg = await Product.aggregate([
    { $match: activeProductFilter({ ShopId: shop._id }) },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$LikeCount", 0] } } } },
  ]);
  const totalLikes = Number(likeAgg?.[0]?.total) || 0;

  let distanceMeters = 0;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Number.isFinite(Number(shop.latitude)) &&
    Number.isFinite(Number(shop.longitude))
  ) {
    distanceMeters = calculateDistanceMeters(
      lat,
      lng,
      Number(shop.latitude),
      Number(shop.longitude)
    );
  }

  const category = resolveShopCategory(categoryNameMap, shop.categoryId);
  return toPublicStore(
    shop,
    seller,
    productCount,
    distanceMeters,
    category.name,
    followCount,
    totalLikes
  );
}

async function listPublicProductsByShopId(shopId) {
  const shop = await ShopProfile.findById(shopId).lean();
  if (!shop || !isSubscriptionActive(shop)) {
    const error = new Error("Không tìm thấy gian hàng.");
    error.statusCode = 404;
    throw error;
  }

  const products = await Product.find(activeProductFilter({ ShopId: shop._id }))
    .sort({ pinProduct: -1, CreatedAt: -1 })
    .lean();

  const { sortProductsByPin } = require("./productService");
  const ordered = sortProductsByPin(products);

  const productIds = ordered.map((product) => product._id);
  const [variants, imagesByProduct] = await Promise.all([
    ProductVariant.find({ ProductId: { $in: productIds } }).lean(),
    loadProductImagesByProductIds(productIds),
  ]);
  const variantsByProduct = variants.reduce((map, variant) => {
    const key = String(variant.ProductId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(variant);
    return map;
  }, new Map());

  const { attachPromotionDto } = require("./productPromotionService");

  return ordered.map((product) => {
    const productVariants = variantsByProduct.get(String(product._id)) || [];
    const thumbnails = resolveProductGallery(
      product,
      imagesByProduct.get(String(product._id)) || []
    );
    const variantPrices = productVariants.map((variant) => Number(variant.Price) || 0);
    const minPrice =
      variantPrices.length > 0
        ? Math.min(...variantPrices)
        : Number(product.MinPrice) || 0;
    const maxPrice =
      variantPrices.length > 0
        ? Math.max(...variantPrices)
        : Number(product.MaxPrice) || minPrice;

    const dto = {
      id: String(product._id),
      store_id: String(shop._id),
      name: product.ProductName,
      price: minPrice,
      minPrice,
      maxPrice: maxPrice || minPrice,
      pinProduct: Math.max(0, Math.min(2, Number(product.pinProduct) || 0)),
      soldCount: Number(product.SoldCount) || 0,
      likeCount: Number(product.LikeCount) || 0,
      donVi: product.DonVi || "",
      description: product.Description || "",
      image_emoji: thumbnails[0] ? "🖼️" : "🛒",
      thumbnail: thumbnails[0] || "",
      thumbnails,
      variantCount: productVariants.length,
      isOutOfStock: computeIsOutOfStock(productVariants),
      remainingQuantity: computeRemainingQuantity(productVariants),
      variants: toListVariants(productVariants),
    };
    return attachPromotionDto(dto, product);
  });
}

async function discoverProducts({
  latitude,
  longitude,
  radiusMeters = 5000,
  categoryId = "",
  search = "",
  limit = 80,
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = resolveSearchRadius(radiusMeters, 5000);
  const maxResults = Math.min(Math.max(Number(limit) || 80, 1), 200);
  const keyword = normalizeSearchText(search);
  const normalizedCategoryId = String(categoryId || "").trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error("Thiếu tọa độ hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const shops = await ShopProfile.find({
    latitude: { $ne: null },
    longitude: { $ne: null },
    status: { $ne: 0 },
    ...activeSubscriptionFilter(),
  }).lean();

  const sellerIds = shops
    .map((shop) => shop.userId)
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  const sellers = await User.find({
    _id: { $in: sellerIds },
    Role: USER_ROLE.SELLER,
  }).lean();
  const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller]));

  const shopDistanceMap = new Map();
  const eligibleShopIds = [];

  for (const shop of shops) {
    if (!Number.isFinite(Number(shop.latitude)) || !Number.isFinite(Number(shop.longitude))) {
      continue;
    }

    const seller = sellerMap.get(String(shop.userId));
    if (!seller) {
      continue;
    }

    const distanceMeters = calculateDistanceMeters(
      lat,
      lng,
      Number(shop.latitude),
      Number(shop.longitude)
    );

    if (radius != null && distanceMeters > radius) {
      continue;
    }

    shopDistanceMap.set(String(shop._id), {
      shop,
      distanceMeters,
    });
    eligibleShopIds.push(shop._id);
  }

  if (eligibleShopIds.length === 0) {
    return [];
  }

  const productFilter = activeProductFilter({ ShopId: { $in: eligibleShopIds } });
  if (normalizedCategoryId) {
    productFilter.CategoryId = normalizedCategoryId;
  }

  // Khi có keyword: lấy SP rồi lọc bỏ dấu + lowercase ở bộ nhớ (regex DB không match tiếng Việt bỏ dấu).
  let productsQuery = Product.find(productFilter);
  if (keyword || radius == null) {
    productsQuery = productsQuery.lean();
  } else {
    productsQuery = productsQuery.sort({ CreatedAt: -1 }).limit(maxResults).lean();
  }
  let products = await productsQuery;
  if (keyword) {
    products = products.filter((product) => textMatchesKeyword(product.ProductName, keyword));
  }

  if (products.length === 0) {
    return [];
  }

  const productIds = products.map((product) => product._id);
  const [variants, imagesByProduct] = await Promise.all([
    ProductVariant.find({ ProductId: { $in: productIds } }).lean(),
    loadProductImagesByProductIds(productIds),
  ]);
  const variantsByProduct = variants.reduce((map, variant) => {
    const key = String(variant.ProductId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(variant);
    return map;
  }, new Map());

  const { getProductCategoryNameMap } = require("./productCategoryService");
  const { attachPromotionDto } = require("./productPromotionService");
  const categoryNameMap = await getProductCategoryNameMap(
    products.map((product) => product.CategoryId)
  );

  const enriched = products.map((product) => {
    const shopMeta = shopDistanceMap.get(String(product.ShopId));
    const shop = shopMeta?.shop;
    const seller = shop ? sellerMap.get(String(shop.userId)) : null;
    const storeName =
      pickString(seller?.FullName) ||
      pickString(seller?.UserName) ||
      pickString(shop?.shopName) ||
      (shop?.shopUsername ? `@${shop.shopUsername}` : "");
    const productVariants = variantsByProduct.get(String(product._id)) || [];
    const thumbnails = resolveProductGallery(
      product,
      imagesByProduct.get(String(product._id)) || []
    );
    const variantPrices = productVariants.map((variant) => Number(variant.Price) || 0);
    const minPrice =
      variantPrices.length > 0 ? Math.min(...variantPrices) : Number(product.MinPrice) || 0;
    const maxPrice =
      variantPrices.length > 0 ? Math.max(...variantPrices) : Number(product.MaxPrice) || minPrice;

    return attachPromotionDto(
      {
        id: String(product._id),
        store_id: String(product.ShopId),
        name: product.ProductName,
        price: minPrice,
        minPrice,
        maxPrice: maxPrice || minPrice,
        soldCount: Number(product.SoldCount) || 0,
        likeCount: Number(product.LikeCount) || 0,
        donVi: product.DonVi || "",
        description: product.Description || "",
        image_emoji: thumbnails[0] ? "🖼️" : "🛒",
        thumbnail: thumbnails[0] || "",
        thumbnails,
        variantCount: productVariants.length,
        categoryId: String(product.CategoryId || ""),
        categoryName: categoryNameMap.get(String(product.CategoryId)) || "",
        storeName,
        location: shop?.addressHeThong || shop?.address || "",
        distanceMeters: shopMeta?.distanceMeters ?? null,
        isOutOfStock: computeIsOutOfStock(productVariants),
        remainingQuantity: computeRemainingQuantity(productVariants),
        variants: toListVariants(productVariants),
      },
      product
    );
  });

  enriched.sort((left, right) => {
    const leftDistance = Number(left.distanceMeters) || Number.MAX_SAFE_INTEGER;
    const rightDistance = Number(right.distanceMeters) || Number.MAX_SAFE_INTEGER;
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }
    return String(right.id).localeCompare(String(left.id));
  });

  return enriched.filter((product) => !product.isOutOfStock).slice(0, maxResults);
}

async function listPublicReviewsByShopId(shopId) {
  const shop = await ShopProfile.findById(shopId).lean();
  if (!shop) {
    const error = new Error("Không tìm thấy gian hàng.");
    error.statusCode = 404;
    throw error;
  }

  const {
    loadReviewImagesMap,
    toPublicReview,
  } = require("./buyerReviewService");

  const rows = await Review.find({
    shopId,
    isDeleted: { $ne: true },
    isHidden: { $ne: true },
  })
    .sort({ CreatedAt: -1 })
    .lean();

  const imagesByReview = await loadReviewImagesMap(rows.map((row) => row._id));
  const userIds = rows.map((row) => row.userId).filter(Boolean);
  const productIds = rows.map((row) => row.productId).filter(Boolean);
  const User = require("../models/User");
  const Product = require("../models/Product");
  const [users, products] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } }).select("FullName UserName Avatar").lean()
      : [],
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("ProductName").lean()
      : [],
  ]);
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const productById = new Map(products.map((product) => [String(product._id), product]));

  return Promise.all(
    rows.map((row) =>
      toPublicReview(row, {
        user: userById.get(String(row.userId)),
        product: productById.get(String(row.productId)),
        shop,
        images: imagesByReview.get(String(row._id)) || [],
      })
    )
  );
}

module.exports = {
  listNearbyShops,
  searchShops,
  getPublicShopById,
  MAX_SEARCH_RADIUS_METERS,
  isUnlimitedRadius,
  listPublicProductsByShopId,
  listPublicReviewsByShopId,
  discoverProducts,
};
