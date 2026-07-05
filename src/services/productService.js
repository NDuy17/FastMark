import { getMockProductById, getMockProductsByStoreId } from '../data/storeMockData';
import { ensureSupabaseClient } from './supabaseClient';

export async function fetchProductsByStoreId(storeId) {
  try {
    const supabase = ensureSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: true });

    if (!error && data?.length > 0) {
      return data.map(normalizeProduct);
    }
  } catch {
    // fallback to mock
  }

  const mockProducts = getMockProductsByStoreId(storeId);
  return mockProducts.length > 0 ? mockProducts : makeFallbackProducts(storeId);
}

export async function fetchProductById(productId) {
  const fallbackProduct = getFallbackProductById(productId);
  if (fallbackProduct) {
    return fallbackProduct;
  }

  try {
    const supabase = ensureSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();

    if (!error && data) {
      return normalizeProduct(data);
    }
  } catch {
    // fallback to mock
  }

  return getMockProductById(productId);
}

function normalizeProduct(row) {
  return {
    id: row.id,
    store_id: row.store_id,
    name: row.name,
    price: row.price,
    description: row.description || '',
    image_emoji: row.image_emoji || '📦',
  };
}

function makeFallbackProducts(storeId) {
  return [
    {
      id: `fallback-${storeId}-1`,
      store_id: storeId,
      name: 'Sản phẩm bán chạy',
      price: 35000,
      description: 'Sản phẩm mẫu của gian hàng, dùng để test màn hình chi tiết sản phẩm.',
      image_emoji: '⭐',
    },
    {
      id: `fallback-${storeId}-2`,
      store_id: storeId,
      name: 'Combo tiết kiệm',
      price: 59000,
      description: 'Combo mẫu có giá ưu đãi, phù hợp để kiểm tra danh sách sản phẩm đang bán.',
      image_emoji: '🛍️',
    },
    {
      id: `fallback-${storeId}-3`,
      store_id: storeId,
      name: 'Món mới hôm nay',
      price: 45000,
      description: 'Món mới được tạo tự động khi gian hàng chưa có dữ liệu sản phẩm thật.',
      image_emoji: '🔥',
    },
  ];
}

function getFallbackProductById(productId) {
  const match = String(productId).match(/^fallback-(.+)-([123])$/);
  if (!match) {
    return null;
  }

  const [, storeId] = match;
  return makeFallbackProducts(storeId).find((product) => product.id === productId) || null;
}
