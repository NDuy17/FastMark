import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEADER_GAP = 8;
const TAB_BAR_EXTRA = 8;
/** Chiều cao ước lượng tab bar (minHeight 58 + padding) khi tab đang hiện. */
const TAB_BAR_CLEARANCE = 88;
/** Padding thêm khi màn nested (ẩn tab bar) — tránh che bởi home indicator. */
const NESTED_EXTRA = 32;

export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  const bottomSpacing = Math.max(insets.bottom, 12);

  return {
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
    headerPaddingTop: insets.top + HEADER_GAP,
    contentPaddingTop: HEADER_GAP,
    tabBarPaddingBottom: Math.max(insets.bottom, TAB_BAR_EXTRA),
    floatingTop: insets.top + HEADER_GAP,
    bottomSpacing,
    /** Scroll content khi tab bar đang hiện (Home, Shop hub, Profile, Orders…). */
    tabRootScrollPaddingBottom: Math.max(bottomSpacing, 24) + TAB_BAR_CLEARANCE,
    /** Scroll/list khi tab bar ẩn (overlay, ProfileSubScreen, Ví…). */
    nestedScrollPaddingBottom: bottomSpacing + NESTED_EXTRA,
  };
}
