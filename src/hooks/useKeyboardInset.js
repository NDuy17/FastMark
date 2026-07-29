import { useEffect, useState } from 'react';

import {
  KEYBOARD_COMPOSER_GAP,
  KEYBOARD_LAYOUT_HIDDEN,
  subscribeKeyboardInsets,
} from '../core/utils/keyboardInset';
import { useScreenInsets } from './useScreenInsets';

/**
 * Theo dõi chiều cao bàn phím và padding scroll phù hợp Safe Area.
 * @param {{ bottomSafeInset?: number, suppressHideRef?: import('react').MutableRefObject<boolean> }} [options]
 */
export function useKeyboardInset(options = {}) {
  const screenInsets = useScreenInsets();
  const { bottomSafeInset, suppressHideRef } = options;
  const [layout, setLayout] = useState(KEYBOARD_LAYOUT_HIDDEN);

  useEffect(() => {
    return subscribeKeyboardInsets({
      bottomSafeInset: bottomSafeInset ?? screenInsets.bottom,
      shouldSuppressHide: () => Boolean(suppressHideRef?.current),
      onChange: setLayout,
    });
  }, [bottomSafeInset, screenInsets.bottom, suppressHideRef]);

  const {
    inset: keyboardInset,
    composerBottom,
    isWindowResized,
    isKeyboardVisible,
  } = layout;

  function getScrollPaddingBottom(extraBottom = 0, { nestedWhenClosed = true } = {}) {
    if (isKeyboardVisible) {
      const scrollInset = isWindowResized ? KEYBOARD_COMPOSER_GAP : keyboardInset;
      return scrollInset + extraBottom;
    }

    const closedPadding = nestedWhenClosed
      ? screenInsets.nestedScrollPaddingBottom
      : Math.max(screenInsets.bottomSpacing, 16);

    return closedPadding + extraBottom;
  }

  return {
    keyboardInset,
    composerBottom,
    isWindowResized,
    isKeyboardVisible,
    keyboardGap: KEYBOARD_COMPOSER_GAP,
    screenInsets,
    getScrollPaddingBottom,
  };
}
