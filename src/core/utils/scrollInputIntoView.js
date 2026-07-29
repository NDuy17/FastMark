import { Dimensions, Platform } from 'react-native';

import { KEYBOARD_COMPOSER_GAP } from './keyboardInset';

/**
 * Cuộn ScrollView để input đang focus nằm phía trên bàn phím.
 */
export function scrollInputIntoView(
  scrollRef,
  inputRef,
  { keyboardInset = 0, gap = 24, scrollY = 0, getScrollY } = {}
) {
  const scrollNode = scrollRef?.current;
  const inputNode = inputRef?.current;

  if (!scrollNode || !inputNode) {
    return;
  }

  function attemptScroll() {
    const currentScrollY =
      typeof getScrollY === 'function' ? getScrollY() : scrollY;

    inputNode.measureInWindow((_x, inputY, _width, inputHeight) => {
      const windowHeight = Dimensions.get('window').height;
      const visibleBottom =
        windowHeight - Math.max(keyboardInset, 0) - KEYBOARD_COMPOSER_GAP - gap;
      const inputBottom = inputY + inputHeight;

      if (inputBottom <= visibleBottom) {
        return;
      }

      const overflow = inputBottom - visibleBottom;

      scrollNode.scrollTo({
        y: Math.max(0, currentScrollY + overflow),
        animated: true,
      });
    });
  }

  requestAnimationFrame(attemptScroll);

  if (Platform.OS === 'android') {
    setTimeout(attemptScroll, 80);
    setTimeout(attemptScroll, 220);
  }
}
