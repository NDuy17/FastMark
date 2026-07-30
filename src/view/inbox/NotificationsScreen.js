import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getMyNotificationsOnBackend } from '../../api/notificationApi';
import {
  notificationMatchesAudience,
  prependUniqueNotification,
} from '../../core/utils/notificationRealtime';
import { showErrorAlert } from '../../core/utils/appAlert';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import { useNotificationSocket } from '../../hooks/useNotificationSocket';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import {
  NOTIFICATION_TAB,
  NOTIFICATION_TABS,
  filterNotificationsByTab,
  resolveNotificationIndex,
} from '../../constants/notifications';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import OrderStatusTabBar from '../shared/components/OrderStatusTabBar';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import NotificationDetailScreen from './NotificationDetailScreen';

function formatNotificationTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return 'Vừa xong';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} phút`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} giờ`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} ngày`;
  }

  return date.toLocaleDateString('vi-VN');
}

function capitalizeFirstLetter(value = '') {
  const text = String(value).trim();
  if (!text) {
    return '';
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function NotificationsScreen({
  onNavigationStateChange,
  audience = 'buyer',
  onBack = null,
  isScreenActive = true,
}) {
  const insets = useScreenInsets();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const loadingGuardRef = useRef(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [activeTab, setActiveTab] = useState(NOTIFICATION_TAB.ALL);

  const filteredNotifications = useMemo(
    () => filterNotificationsByTab(notifications, activeTab),
    [notifications, activeTab]
  );

  const loadNotifications = useCallback(async ({ nextPage = 1, refresh = false } = {}) => {
    if (loadingGuardRef.current) {
      return;
    }
    loadingGuardRef.current = true;
    if (nextPage === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const result = await getMyNotificationsOnBackend(audience, {
        page: nextPage,
        limit: DEFAULT_PAGE_SIZE,
      });
      const items = (result.items || []).map((item) => ({
        ...item,
        index: resolveNotificationIndex(item),
      }));
      setNotifications((current) =>
        nextPage === 1 ? items : appendUniqueById(current, items)
      );
      setPage(Number(result.page) || nextPage);
      setHasMore(Boolean(result.hasMore));
      setTotalCount(Math.max(0, Number(result.total) || 0));
    } catch (error) {
      if (nextPage === 1) {
        setNotifications([]);
        setHasMore(false);
        setTotalCount(0);
      }
      showErrorAlert(error.message || 'Không tải được thông báo.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      loadingGuardRef.current = false;
    }
  }, [audience]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore || loadingGuardRef.current) {
      return;
    }
    loadNotifications({ nextPage: page + 1 });
  }, [hasMore, isLoading, isLoadingMore, loadNotifications, page]);

  const handleRealtimeNotification = useCallback(
    (notification) => {
      if (!isScreenActive || !notificationMatchesAudience(notification, audience)) {
        return;
      }

      setNotifications((current) => prependUniqueNotification(current, notification));
    },
    [audience, isScreenActive]
  );

  useNotificationSocket({
    enabled: isScreenActive,
    onNotificationNew: handleRealtimeNotification,
  });

  useEffect(() => {
    if (!isScreenActive) {
      setSelectedNotification(null);
      setActiveTab(NOTIFICATION_TAB.ALL);
      return;
    }
    loadNotifications({ nextPage: 1 });
  }, [isScreenActive, loadNotifications]);

  useEffect(() => {
    onNavigationStateChange?.(Boolean(isScreenActive && selectedNotification));
  }, [isScreenActive, onNavigationStateChange, selectedNotification]);

  if (selectedNotification) {
    return (
      <NotificationDetailScreen
        notification={selectedNotification}
        audience={audience}
        onBack={() => {
          setSelectedNotification(null);
          loadNotifications({ nextPage: 1, refresh: true });
        }}
        onMarkedRead={(id) => {
          setNotifications((current) =>
            current.map((item) =>
              String(item.id) === String(id) ? { ...item, isRead: true } : item
            )
          );
          setSelectedNotification((current) =>
            current && String(current.id) === String(id)
              ? { ...current, isRead: true }
              : current
          );
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Thông báo" onBack={onBack} />

      <OrderStatusTabBar tabs={NOTIFICATION_TABS} activeTab={activeTab} onChangeTab={setActiveTab} />

      {isLoading && filteredNotifications.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" />
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: onBack
                ? insets.nestedScrollPaddingBottom
                : insets.tabRootScrollPaddingBottom,
            },
          ]}
          refreshing={isLoading}
          onRefresh={() => loadNotifications({ nextPage: 1, refresh: true })}
          ListFooterComponent={
            filteredNotifications.length > 0 ? (
              <LoadMoreButton
                currentCount={filteredNotifications.length}
                totalCount={
                  activeTab === NOTIFICATION_TAB.ALL
                    ? Math.max(totalCount, filteredNotifications.length)
                    : hasMore
                      ? filteredNotifications.length + DEFAULT_PAGE_SIZE
                      : filteredNotifications.length
                }
                loading={isLoadingMore}
                onPress={handleLoadMore}
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>
                {activeTab === NOTIFICATION_TAB.ALL
                  ? 'Chưa có thông báo'
                  : activeTab === NOTIFICATION_TAB.ORDER
                    ? 'Chưa có thông báo đơn hàng'
                    : 'Chưa có thông báo hệ thống'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.listItem} onPress={() => setSelectedNotification(item)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>🔔</Text>
              </View>
              <View style={styles.listBody}>
                <View style={styles.listTopRow}>
                  <Text style={styles.notificationTitle} numberOfLines={1}>
                    {capitalizeFirstLetter(item.title)}
                  </Text>
                  <Text style={styles.listTime}>{formatNotificationTime(item.createdAt)}</Text>
                </View>
                <Text style={styles.notificationBody} numberOfLines={2}>
                  {item.content || item.body || ''}
                </Text>
              </View>
              {!item.isRead ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  errorText: {
    color: '#dc2626',
    marginHorizontal: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#076F32' },
  listBody: { flex: 1, minWidth: 0 },
  listTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  notificationTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', flex: 1 },
  notificationBody: {
    color: '#94a3b8',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  listTime: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e53935',
    marginLeft: 8,
  },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
});
