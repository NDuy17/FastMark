export function normalizeReview(row) {
  const images = Array.isArray(row.images)
    ? row.images
        .map((image) => ({
          id: image.id || image._id || '',
          imageUrl: image.imageUrl || image.ImageUrl || '',
          stt: Number(image.stt ?? image.Stt ?? 0) || 0,
        }))
        .filter((image) => image.imageUrl)
    : [];

  const imageUrl =
    images[0]?.imageUrl || row.imageUrl || row.image_url || '';

  return {
    id: row.id,
    store_id: row.store_id || row.storeId || row.shopId || '',
    shopId: row.shopId || row.storeId || row.store_id || '',
    productId: row.productId || '',
    productName: row.productName || '',
    reservationId: row.reservationId || row.orderCode || '',
    user_name: row.user_name || row.userName || 'Khách hàng',
    avatar: row.avatar || row.photoUrl || row.userAvatar || '',
    photoUrl: row.photoUrl || row.avatar || row.userAvatar || '',
    rating: row.rating,
    comment: row.comment || '',
    images,
    image_url: imageUrl,
    imageUrl,
    created_at: row.created_at || row.createdAt || null,
    createdAt: row.created_at || row.createdAt || null,
  };
}
