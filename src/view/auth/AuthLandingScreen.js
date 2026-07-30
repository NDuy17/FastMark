import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AUTH_COLORS, AUTH_RADIUS } from './components/authTheme';

/**
 * Màn sau splash: ảnh landing + nút Đăng nhập / Đăng ký.
 */
export default function AuthLandingScreen({ onGoLogin, onGoRegister }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <Image
        source={require('../../../assets/auth-landing.jpg')}
        style={styles.hero}
        resizeMode="cover"
      />

      <View
        style={[
          styles.actions,
          { paddingBottom: Math.max(insets.bottom, 16) + 12 },
        ]}
      >
        <Pressable
          onPress={onGoLogin}
          style={({ pressed }) => [styles.loginBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Đăng nhập"
        >
          <Ionicons name="leaf" size={18} color="#ffffff" style={styles.btnIcon} />
          <Text style={styles.loginBtnText}>Đăng nhập</Text>
        </Pressable>

        <Pressable
          onPress={onGoRegister}
          style={({ pressed }) => [styles.registerBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Đăng ký"
        >
          <Ionicons
            name="person-add-outline"
            size={18}
            color={AUTH_COLORS.primary}
            style={styles.btnIcon}
          />
          <Text style={styles.registerBtnText}>Đăng ký</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#e8f6ec',
  },
  hero: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    gap: 12,
    // Che phần nút vẽ sẵn trên ảnh mockup.
    paddingTop: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  loginBtn: {
    minHeight: 54,
    borderRadius: AUTH_RADIUS.button,
    backgroundColor: AUTH_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AUTH_COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  registerBtn: {
    minHeight: 54,
    borderRadius: AUTH_RADIUS.button,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: {
    marginRight: 8,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  registerBtnText: {
    color: AUTH_COLORS.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
