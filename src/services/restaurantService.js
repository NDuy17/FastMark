import { MOCK_STORES } from '../data/storeMockData';
import { ensureSupabaseClient } from './supabaseClient';

export async function fetchRestaurants(type = 'all') {
  try {
    const supabase = ensureSupabaseClient();
    let query = supabase.from('restaurants').select('*');
    
    if (type !== 'all') {
      query = query.eq('type', type);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.warn('Supabase fetch error, using fallback mock data:', error.message);
      return getFilteredMockRestaurants(type);
    }
    
    if (data && data.length > 0) {
      return mergeWithMockRestaurants(data, type);
    }
    
    return getFilteredMockRestaurants(type);
  } catch (err) {
    console.warn('Supabase not connected or table not found, using mock data:', err);
    return getFilteredMockRestaurants(type);
  }
}

function mergeWithMockRestaurants(remoteData, type) {
  const mockFiltered = getFilteredMockRestaurants(type);
  const existingIds = new Set(remoteData.map((r) => String(r.id)));
  const extras = mockFiltered.filter((r) => !existingIds.has(String(r.id)));
  return [...remoteData, ...extras];
}

function getFilteredMockRestaurants(type) {
  if (type === 'all') {
    return MOCK_STORES;
  }
  return MOCK_STORES.filter((r) => r.type === type);
}
