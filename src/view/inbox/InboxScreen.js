import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';

import {
  getBuyerConversationsOnBackend,
} from '../../api/messageApi';
import { getMyNotificationsOnBackend } from '../../api/notificationApi';
import { getSellerConversationsOnBackend } from '../../api/sellerOpsApi';
import {
  notificationMatchesAudience,
  prependUniqueNotification,
} from '../../core/utils/notificationRealtime';
import { appendUniqueById, DEFAULT_PAGE_SIZE } from '../../core/utils/pagination';
import { useNotificationSocket } from '../../hooks/useNotificationSocket';
import { useMessageInboxSocket } from '../../hooks/useMessageInboxSocket';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { selectIsSeller } from '../../viewmodel/auth/authSelectors';
import AvatarBadge from '../shared/components/AvatarBadge';
import ClearableSearchField from '../shared/components/ClearableSearchField';
import LoadMoreButton from '../shared/components/LoadMoreButton';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import ChatScreen from './ChatScreen';
import NotificationDetailScreen from './NotificationDetailScreen';

const INBOX_TABS = [
  { key: 'messages', label: 'Tin nhắn' },
  { key: 'notifications', label: 'Thông báo' },
];

function ConversationAvatar({ uri, fallbackText }) {
  return <AvatarBadge name={fallbackText} uri={uri} size={48} />;
}
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

  return date.toLocaleString('vi-VN');
}

function capitalizeFirstLetter(value = '') {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getConversationName(item) {
  return item.shop?.name || 'Gian hàng';
}

function getConversationKey(item) {
  return String(item.id || item.shop?.id || item.shopId);
}

function getConversationSearchHaystack(item, isSellerInbox = false) {
  if (isSellerInbox) {
    return [
      item.buyer?.fullName,
      item.buyer?.name,
      item.buyer?.userName,
      item.lastMessage,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  return [getConversationName(item), item.lastMessage].filter(Boolean).join(' ').toLowerCase();
}

function filterConversations(conversations, query, isSellerInbox = false) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) {
    return conversations;
  }

  return conversations.filter((item) =>
    getConversationSearchHaystack(item, isSellerInbox).includes(keyword)
  );
}

function hasRealMessage(conversation) {
  return Boolean(String(conversation?.lastMessage || '').trim());
}

export default function InboxScreen({
  chatRequest = null,
  buyerView = false,
  messagesOnly = false,
  onViewShop,
  onBack = null,
  onNavigationStateChange,
}) {
  const insets = useScreenInsets();
  const isSeller = useSelector(selectIsSeller);
  const showSellerInbox = isSeller && !buyerView;
  const [activeTab, setActiveTab] = useState('messages');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationPage, setNotificationPage] = useState(1);
  const [notificationsHasMore, setNotificationsHasMore] = useState(true);
  const [notificationTotal, setNotificationTotal] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [isLoadingMoreNotifications, setIsLoadingMoreNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const notificationLoadGuardRef = useRef(false);
  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    if (showSellerInbox) {
      try {
        const idToken = await getCurrentUserIdToken();
        const data = await getSellerConversationsOnBackend(idToken);
        setConversations(
          (Array.isArray(data) ? data : []).filter((item) => hasRealMessage(item))
        );
      } catch {
        setConversations([]);
        setLoadError('Không tải được hộp thư người bán.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const conversationRows = await getBuyerConversationsOnBackend();
      setConversations(
        (Array.isArray(conversationRows) ? conversationRows : []).filter((item) =>
          hasRealMessage(item)
        )
      );
    } catch (error) {
      setConversations([]);
      setLoadError(error.message || 'Không tải được hộp thư. Vui lòng đăng nhập lại.');
    } finally {
      setIsLoading(false);
    }
  }, [showSellerInbox]);

  const loadNotifications = useCallback(async ({ nextPage = 1 } = {}) => {
    if (notificationLoadGuardRef.current) {
      return;
    }
    notificationLoadGuardRef.current = true;
    if (nextPage === 1) {
      setIsLoadingNotifications(true);
    } else {
      setIsLoadingMoreNotifications(true);
    }
    setNotificationError('');

    try {
      // Tab thông báo trong inbox buyer luôn lấy audience buyer (không lẫn shop).
      const result = await getMyNotificationsOnBackend('buyer', {
        page: nextPage,
        limit: DEFAULT_PAGE_SIZE,
      });
      const items = Array.isArray(result?.items) ? result.items : [];
      setNotifications((current) =>
        nextPage === 1 ? items : appendUniqueById(current, items)
      );
      setNotificationPage(Number(result?.page) || nextPage);
      setNotificationsHasMore(Boolean(result?.hasMore));
      setNotificationTotal(Math.max(0, Number(result?.total) || 0));
    } catch (error) {
      if (nextPage === 1) {
        setNotifications([]);
        setNotificationsHasMore(false);
        setNotificationTotal(0);
      }
      setNotificationError(error.message || 'Không tải được thông báo.');
    } finally {
      setIsLoadingNotifications(false);
      setIsLoadingMoreNotifications(false);
      notificationLoadGuardRef.current = false;
    }
  }, []);

  const handleLoadMoreNotifications = useCallback(() => {
    if (
      !notificationsHasMore ||
      isLoadingNotifications ||
      isLoadingMoreNotifications ||
      notificationLoadGuardRef.current
    ) {
      return;
    }
    loadNotifications({ nextPage: notificationPage + 1 });
  }, [
    isLoadingMoreNotifications,
    isLoadingNotifications,
    loadNotifications,
    notificationPage,
    notificationsHasMore,
  ]);
  const handleRealtimeNotification = useCallback((notification) => {
    if (messagesOnly || activeTab !== 'notifications') {
      return;
    }
    if (!notificationMatchesAudience(notification, 'buyer')) {
      return;
    }

    setNotifications((current) => prependUniqueNotification(current, notification));
  }, [activeTab, messagesOnly]);

  useNotificationSocket({
    enabled: !messagesOnly && activeTab === 'notifications',
    onNotificationNew: handleRealtimeNotification,
  });

  const handleInboxMessageSent = useCallback(() => {
    if (messagesOnly || activeTab === 'messages') {
      loadConversations();
    }
  }, [activeTab, loadConversations, messagesOnly]);

  useMessageInboxSocket({
    enabled: !messagesOnly,
    onMessageSent: handleInboxMessageSent,
  });

  useEffect(() => {
    if (buyerView || messagesOnly || activeTab === 'messages') {
      loadConversations();
    }
  }, [activeTab, buyerView, loadConversations, messagesOnly]);

  useEffect(() => {
    if (!messagesOnly && activeTab === 'notifications') {
      loadNotifications({ nextPage: 1 });
    }
  }, [activeTab, loadNotifications, messagesOnly]);

  useEffect(() => {
    if (!chatRequest?.shopId || showSellerInbox) {
      return;
    }

    setActiveTab('messages');
    setSelectedChat({
      conversationId: null,
      shopId: chatRequest.shopId,
      shopName: chatRequest.shopName || 'Gian hàng',
    });
  }, [chatRequest?.at, chatRequest?.shopId, chatRequest?.shopName, showSellerInbox]);

  useEffect(() => {
    onNavigationStateChange?.(Boolean(selectedChat));
  }, [onNavigationStateChange, selectedChat]);

  const messageConversations = useMemo(() => {
    return filterConversations(conversations, searchQuery, showSellerInbox);
  }, [conversations, searchQuery, showSellerInbox]);

  if (selectedNotification) {
    return (
      <NotificationDetailScreen
        notification={selectedNotification}
        audience="buyer"
        onBack={() => {
          setSelectedNotification(null);
          loadNotifications({ nextPage: 1 });
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

  if (selectedChat) {
    return (
      <ChatScreen
        mode={showSellerInbox ? 'seller' : 'buyer'}
        conversationId={selectedChat.conversationId || selectedChat.id}
        shopId={selectedChat.shopId}
        shopName={selectedChat.shopName}
        buyerId={selectedChat.buyerId}
        buyerName={selectedChat.buyerName}
        buyerAvatar={selectedChat.buyerAvatar}
        onBack={() => {
          setSelectedChat(null);
          loadConversations();
        }}
        onConversationPreviewChange={(conversationId, lastMessage) => {
          if (!conversationId || !lastMessage) {
            return;
          }
          setConversations((current) =>
            current.map((item) =>
              String(item.id) === String(conversationId)
                ? { ...item, lastMessage, timeLabel: 'Vừa xong' }
                : item
            )
          );
        }}
        onViewShop={onViewShop}
      />
    );
  }

  const showInboxTabs = !buyerView && !messagesOnly;
  const listTab = messagesOnly ? 'messages' : activeTab;

  return (
    <View style={styles.screen}>
      <SubScreenHeader title="Tin nhắn" onBack={onBack} />

      {showInboxTabs ? (
        <View style={styles.tabRow}>
          {INBOX_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {(buyerView || listTab === 'messages') ? (
        <View style={styles.searchBar}>
          <ClearableSearchField
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              showSellerInbox ? 'Tìm theo tên khách, tin nhắn...' : 'Tìm kiếm cuộc trò chuyện...'
            }
          />
        </View>
      ) : null}

      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
      {notificationError && listTab === 'notifications' ? (
        <Text style={styles.errorText}>{notificationError}</Text>
      ) : null}

      {buyerView || listTab === 'messages' ? (
        isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#076F32" />
          </View>
        ) : (
          <FlatList
            data={messageConversations}
            keyExtractor={(item) =>
              showSellerInbox ? String(item.id) : getConversationKey(item)
            }
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.nestedScrollPaddingBottom },
            ]}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>
                  {searchQuery.trim()
                    ? 'Không tìm thấy cuộc trò chuyện'
                    : showSellerInbox
                      ? 'Chưa có tin nhắn'
                      : 'Chưa có cuộc trò chuyện'}
                </Text>
                {!showSellerInbox && !searchQuery.trim() ? (
                  <Text style={styles.emptySubtitle}>
                    Khi bạn nhắn tin với gian hàng, hội thoại sẽ hiện ở đây.
                  </Text>
                ) : null}
              </View>
            }
            renderItem={({ item }) =>
              showSellerInbox ? (
                <Pressable
                  style={styles.listItem}
                  onPress={() =>
                    setSelectedChat({
                      conversationId: item.id,
                      buyerId: item.buyer?.id,
                      buyerName:
                        item.buyer?.fullName || item.buyer?.userName || 'Khách hàng',
                      buyerAvatar: item.buyer?.avatar || '',
                    })
                  }
                >
                  <ConversationAvatar
                    uri={item.buyer?.avatar}
                    fallbackText={item.buyer?.fullName || item.buyer?.userName || 'K'}
                  />
                  <View style={styles.listBody}>
                    <View style={styles.listTopRow}>
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {item.buyer?.fullName || 'Khách hàng'}
                      </Text>
                      <Text style={styles.listTime}>{item.timeLabel || ''}</Text>
                    </View>
                    <Text
                      style={[
                        styles.listPreview,
                        /đã gỡ/.test(String(item.lastMessage || '')) && styles.listPreviewUnsent,
                      ]}
                      numberOfLines={1}
                    >
                      {item.lastMessage || 'Chưa có tin nhắn'}
                    </Text>
                  </View>
                  {item.unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
                </Pressable>
              ) : (
                <Pressable
                  style={styles.listItem}
                  onPress={() =>
                    setSelectedChat({
                      conversationId: item.id,
                      shopId: item.shop?.id || item.shopId,
                      shopName: getConversationName(item),
                    })
                  }
                >
                  <ConversationAvatar
                    uri={item.shop?.avatar}
                    fallbackText={getConversationName(item)}
                  />
                  <View style={styles.listBody}>
                    <View style={styles.listTopRow}>
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {getConversationName(item)}
                      </Text>
                      <Text style={styles.listTime}>{item.timeLabel || ''}</Text>
                    </View>
                    <Text
                      style={[
                        styles.listPreview,
                        /đã gỡ/.test(String(item.lastMessage || '')) && styles.listPreviewUnsent,
                      ]}
                      numberOfLines={1}
                    >
                      {item.lastMessage || 'Chưa có tin nhắn'}
                    </Text>
                  </View>
                  {item.unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
                </Pressable>
              )
            }
          />
        )
      ) : isLoadingNotifications ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#076F32" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.nestedScrollPaddingBottom },
          ]}
          ListFooterComponent={
            notifications.length > 0 ? (
              <LoadMoreButton
                currentCount={notifications.length}
                totalCount={
                  notificationsHasMore
                    ? Math.max(notificationTotal, notifications.length + DEFAULT_PAGE_SIZE)
                    : notifications.length
                }
                loading={isLoadingMoreNotifications}
                onPress={handleLoadMoreNotifications}
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
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
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
  },
  tabItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  tabItemActive: { backgroundColor: '#E6F4EC' },
  tabText: { fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#076F32' },
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  listContent: { paddingHorizontal: 16 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6F4EC',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#076F32' },
  listBody: { flex: 1, minWidth: 0, gap: 4 },
  listTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  listTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', flex: 1 },
  notificationTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', flex: 1 },
  notificationBody: {
    color: '#94a3b8',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  listTime: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  listPreview: { color: '#64748b', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  listPreviewUnsent: { fontStyle: 'italic', color: '#475569' },
  listPreviewNew: { color: '#076F32', fontWeight: '700' },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginLeft: 8,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#64748b', textAlign: 'center' },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    marginHorizontal: 16,
    marginBottom: 8,
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
});
