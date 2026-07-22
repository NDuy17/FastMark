import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import { getCurrentUserIdToken } from '../../repository/authRepository';
import {
  confirmBuyerReceivedOnBackend,
  validateBuyerShopQrOnBackend,
} from '../../api/buyerOpsApi';
import { buyerTheme as t } from '../../core/theme/buyerTheme';
import CircularBackButton from '../shared/components/CircularBackButton';

/** Parse QR cố định shop: {"shopId":"..."} | FM|SHOP|id | plain id */
export function parseShopQrPayload(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return '';
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      const id = String(parsed.shopId || parsed.shop_id || parsed.id || '').trim();
      if (id) {
        return id;
      }
    }
  } catch {
    // not JSON
  }

  const pipe = text.match(/^FM\|SHOP\|(.+)$/i);
  if (pipe?.[1]) {
    return String(pipe[1]).trim();
  }

  return text;
}

export default function BuyerShopQrScanScreen({
  reservationId,
  expectedShopId,
  storeName,
  onBack,
  onCompleted,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [torch, setTorch] = useState(false);
  const lastScanRef = useRef('');
  const lockRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScannedShopId = useCallback(
    async (scannedShopId) => {
      if (!scannedShopId || lockRef.current) {
        return;
      }

      lockRef.current = true;
      setIsSubmitting(true);
      try {
        const idToken = await getCurrentUserIdToken();
        await validateBuyerShopQrOnBackend(idToken, {
          reservationId,
          scannedShopId,
        });

        Alert.alert('Bạn xác nhận đã nhận hàng?', 'Tiền cọc sẽ được chuyển cho shop.', [
          {
            text: 'Hủy',
            style: 'cancel',
            onPress: () => {
              lastScanRef.current = '';
              lockRef.current = false;
              setIsSubmitting(false);
            },
          },
          {
            text: 'Xác nhận',
            onPress: async () => {
              try {
                const reservation = await confirmBuyerReceivedOnBackend(idToken, {
                  reservationId,
                  scannedShopId,
                });
                Alert.alert('Thành công', 'Đã xác nhận nhận hàng. Cọc đã chuyển cho shop.', [
                  {
                    text: 'OK',
                    onPress: () => {
                      onCompleted?.(reservation);
                      onBack?.();
                    },
                  },
                ]);
              } catch (confirmError) {
                Alert.alert('Lỗi', confirmError.message || 'Không xác nhận được.');
                lastScanRef.current = '';
                lockRef.current = false;
                setIsSubmitting(false);
              }
            },
          },
        ]);
      } catch (error) {
        Alert.alert('Không hợp lệ', error.message || 'QR không thuộc cửa hàng này');
        lastScanRef.current = '';
        lockRef.current = false;
        setIsSubmitting(false);
      }
    },
    [onBack, onCompleted, reservationId]
  );

  function handleBarcodeScanned({ data }) {
    const payload = String(data || '').trim();
    if (!payload || payload === lastScanRef.current || lockRef.current) {
      return;
    }
    lastScanRef.current = payload;
    const shopId = parseShopQrPayload(payload);
    if (!shopId) {
      lastScanRef.current = '';
      return;
    }
    handleScannedShopId(shopId);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <CircularBackButton onPress={onBack} variant="light" />
        <Text style={styles.title}>Quét mã Shop</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.wrap}>
        <Text style={styles.hint}>
          Quét QR cố định của {storeName || 'cửa hàng'} để xác nhận đã nhận hàng
          {expectedShopId ? '.' : '.'}
        </Text>

        <View style={styles.cameraCard}>
          {!permission ? (
            <View style={styles.cameraPlaceholder}>
              <ActivityIndicator color={t.primary} />
            </View>
          ) : !permission.granted ? (
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.permissionText}>Cần quyền camera để quét mã.</Text>
              <Pressable style={styles.secondaryBtn} onPress={requestPermission}>
                <Text style={styles.secondaryBtnText}>Cấp quyền camera</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <CameraView
                style={styles.camera}
                facing="back"
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={isSubmitting ? undefined : handleBarcodeScanned}
              />
              <View style={styles.scanFrame} pointerEvents="none" />
              <Pressable
                style={styles.torchBtn}
                onPress={() => setTorch((current) => !current)}
              >
                <Ionicons
                  name={torch ? 'flash' : 'flash-outline'}
                  size={20}
                  color="#ffffff"
                />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  topBarSpacer: { width: 40 },
  wrap: { padding: 16 },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748b',
    marginBottom: 14,
    fontWeight: '600',
  },
  cameraCard: {
    height: 360,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  camera: { flex: 1 },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  permissionText: {
    color: '#e2e8f0',
    textAlign: 'center',
    fontWeight: '600',
  },
  scanFrame: {
    position: 'absolute',
    top: '22%',
    left: '16%',
    right: '16%',
    bottom: '22%',
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 16,
  },
  torchBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: '#ffffff', fontWeight: '800' },
});
