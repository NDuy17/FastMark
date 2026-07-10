export function formatOfferMessageContent({
  productName = '',
  originalPrice = 0,
  offeredPrice = 0,
  discountPercent = 0,
  note = '',
} = {}) {
  const lines = [
    '💰 Đề nghị deal giá',
    productName ? `Sản phẩm: ${productName}` : '',
    `Giá gốc: ${Number(originalPrice || 0).toLocaleString('vi-VN')}đ`,
    `Giá đề nghị: ${Number(offeredPrice || 0).toLocaleString('vi-VN')}đ`,
    `Giảm: ${discountPercent || 0}%`,
  ].filter(Boolean);

  if (note) {
    lines.push(`Ghi chú: ${note}`);
  }

  return lines.join('\n');
}

export function parseOfferMessageContent(content) {
  const raw = String(content || '').trim();
  if (!raw) {
    return '';
  }

  if (!raw.startsWith('{')) {
    return raw;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === 'deal_offer' || parsed?.offeredPrice !== undefined) {
      return formatOfferMessageContent({
        productName: parsed.productName || '',
        originalPrice: parsed.originalPrice,
        offeredPrice: parsed.offeredPrice,
        discountPercent: parsed.discountPercent,
        note: parsed.note || '',
      });
    }
  } catch {
    return raw;
  }

  return raw;
}

export function isOfferMessage(item) {
  return Boolean(item?.isOffer || Number(item?.messageType) === 2);
}

export function getReadableMessageContent(item) {
  if (isOfferMessage(item)) {
    return parseOfferMessageContent(item.content);
  }
  return item?.content || '';
}
