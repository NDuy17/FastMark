import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AvatarBadge from './AvatarBadge';
import { formatPrice } from '../../../core/utils/productFormat';

function MenuRow({ icon, label, value, onPress, danger = false, last = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        last && styles.menuRowLast,
        pressed && styles.menuRowPressed,
      ]}
    >
      <View style={styles.menuIconWrap}>
        <Ionicons name={icon} size={22} color={danger ? '#dc2626' : '#0f172a'} />
      </View>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.menuValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </Pressable>
  );
}

function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/**
 * Drawer kiểu TikTok — trượt từ phải, không phải dropdown dialog.
 */
export default function ProfileSideDrawer({
  visible,
  onClose,
  displayName = 'Tài khoản',
  userName = '',
  photoUrl = null,
  walletBalance = 0,
  sections = [],
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng menu"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          style={[
            styles.drawer,
            {
              paddingTop: Math.max(insets.top, 12) + 8,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.header}>
            <AvatarBadge name={displayName} uri={photoUrl} size={52} />
            <View style={styles.headerCopy}>
              <Text style={styles.headerName} numberOfLines={1}>
                {displayName}
              </Text>
              {userName ? (
                <Text style={styles.headerUser} numberOfLines={1}>
                  @{userName}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
            >
              <Ionicons name="close" size={22} color="#64748b" />
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              const walletAction = sections
                .flatMap((section) => section.items || [])
                .find((item) => item.key === 'wallet');
              if (walletAction?.onPress) {
                onClose();
                walletAction.onPress();
              }
            }}
            style={({ pressed }) => [styles.balanceCard, pressed && styles.menuRowPressed]}
          >
            <View style={styles.balanceIcon}>
              <Ionicons name="wallet-outline" size={20} color="#076F32" />
            </View>
            <View style={styles.balanceCopy}>
              <Text style={styles.balanceLabel}>Số dư ví</Text>
              <Text style={styles.balanceValue}>{formatPrice(walletBalance || 0)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((section) => (
              <View key={section.key} style={styles.section}>
                {section.title ? <SectionLabel>{section.title}</SectionLabel> : null}
                <View style={styles.sectionCard}>
                  {(section.items || []).map((item, index, list) => (
                    <MenuRow
                      key={item.key}
                      icon={item.icon}
                      label={item.label}
                      value={item.value}
                      danger={item.danger}
                      last={index === list.length - 1}
                      onPress={() => {
                        onClose();
                        item.onPress?.();
                      }}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  drawer: {
    width: '82%',
    maxWidth: 360,
    height: '100%',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerUser: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#E6F4EC',
    marginBottom: 18,
  },
  balanceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  balanceCopy: {
    flex: 1,
    minWidth: 0,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  balanceValue: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '900',
    color: '#076F32',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    paddingHorizontal: 4,
  },
  sectionCard: {
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuRowPressed: {
    backgroundColor: '#f1f5f9',
  },
  menuIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  menuLabelDanger: {
    color: '#dc2626',
  },
  menuValue: {
    maxWidth: 100,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
});
