import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';

import {
  deleteBuyerMessageOnBackend,
  getBuyerConversationPeerOnBackend,
  getBuyerMessagesOnBackend,
  sendBuyerMessageOnBackend,
  startBuyerConversationOnBackend,
} from '../../api/messageApi';
import {
  deleteSellerMessageOnBackend,
  getSellerConversationPeerOnBackend,
  getSellerMessagesOnBackend,
  getSellerShopSettingsOnBackend,
  sendSellerMessageOnBackend,
} from '../../api/sellerOpsApi';
import {
  buildChatImagePayload,
  chooseChatImageSource,
  pickChatImageFromLibrary,
} from '../../core/utils/chatImagePicker';
import { formatActivityLabel } from '../../core/utils/activityLabel';
import { buildChatListItems, markMessagesFromServer, mergeMessages, normalizeMessages, upsertMessage, applyMessageViewerContext } from '../../core/utils/chatMessageUtils';
import { useChatSocket } from '../../hooks/useChatSocket';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { getCurrentUserIdToken } from '../../repository/authRepository';
import { showErrorAlert } from '../../core/utils/appAlert';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { selectAuthProfile, selectAuthUser, selectIsSeller } from '../../viewmodel/auth/authSelectors';
import ChatProfileScreen from './ChatProfileScreen';
import BuyerProfileScreen from '../profile/BuyerProfileScreen';
import SubScreenHeader from '../shared/components/SubScreenHeader';
import AvatarBadge from '../shared/components/AvatarBadge';
import { isRemoteAvatarUrl } from '../../core/utils/avatarInitial';
import StoreDetailScreen from '../store/StoreDetailScreen';

const MESSAGE_STATUS_LABEL = {
  sent: 'Đã gửi',
  delivered: 'Đã nhận',
  seen: 'Đã xem',
};

/** Chiều cao ước lượng thanh nhập tin (padding + nút + input). */
const COMPOSER_BAR_ESTIMATE = 68;

function isRealConversationId(value) {
  const id = String(value || '');
  return id.length > 0 && !id.startsWith('mock-') && !id.startsWith('shop-');
}

function createLocalMessage(content, extra = {}) {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    content,
    isMine: true,
    status: 'sent',
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

function formatTimeLabel(message) {
  if (message?.timeLabel) {
    return message.timeLabel;
  }

  const value = new Date(message?.createdAt || Date.now());
  if (Number.isNaN(value.getTime())) {
    return '';
  }

  return value.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSequenceLabel(sequence) {
  if (!sequence?.total) {
    return '';
  }

  const from = Number(sequence.from) || 1;
  const to = Number(sequence.to) || from;

  if (from === to) {
    return `Tin nhắn #${from}`;
  }

  return `Tin nhắn #${from}–#${to} · ${sequence.total} tin`;
}

function MessageStatus({ status }) {
  if (!status) {
    return null;
  }

  return <Text style={styles.messageStatus}>{MESSAGE_STATUS_LABEL[status] || 'Đã gửi'}</Text>;
}

function DateSeparator({ label }) {
  return (
    <View style={styles.dateSeparatorWrap}>
      <View style={styles.dateSeparatorPill}>
        <Text style={styles.dateSeparatorText}>{label}</Text>
      </View>
    </View>
  );
}

function ImageMessageContent({ imageUri, isMine, caption, isDeleted }) {
  if (isDeleted) {
    return <Text style={styles.deletedText}>Tin nhắn đã được gỡ</Text>;
  }

  return (
    <View style={styles.imageMessageWrap}>
      <Image source={{ uri: imageUri }} style={styles.chatImage} resizeMode="cover" />
      {caption ? (
        <Text style={[styles.imageCaption, isMine && styles.bubbleTextMine]}>{caption}</Text>
      ) : null}
    </View>
  );
}

function ChatBubble({ item, peerAvatarUri, peerName, onLongPress }) {
  const isMine = Boolean(item.isMine);
  const isDeleted = Boolean(item.isDeleted);
  const timeLabel = formatTimeLabel(item);

  const bubbleBody = item.imageUri ? (
    <ImageMessageContent
      imageUri={item.imageUri}
      isMine={isMine}
      caption={item.content}
      isDeleted={isDeleted}
    />
  ) : (
    <Text
      style={[
        styles.bubbleText,
        isMine && !isDeleted && styles.bubbleTextMine,
        isDeleted && styles.deletedText,
      ]}
    >
      {item.content}
    </Text>
  );

  if (isMine) {
    return (
      <Pressable onLongPress={() => onLongPress?.(item)} delayLongPress={350}>
        <View style={[styles.messageRow, styles.messageRowMine]}>
          <View
            style={[
              styles.bubble,
              isDeleted ? styles.bubbleDeleted : styles.bubbleMine,
              item.imageUri && !isDeleted && styles.bubbleImage,
            ]}
          >
            {bubbleBody}
            <View style={styles.bubbleMetaMine}>
              {timeLabel ? (
                <Text style={isDeleted ? styles.bubbleTimeDeleted : styles.bubbleTimeMine}>
                  {timeLabel}
                </Text>
              ) : null}
              {!isDeleted ? <MessageStatus status={item.status} /> : null}
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.messageRowOtherWrap}>
      <AvatarBadge name={peerName} uri={peerAvatarUri} size={28} />
      <View style={styles.messageRowOther}>
        <View
          style={[
            styles.bubble,
            isDeleted ? styles.bubbleDeleted : styles.bubbleOther,
            item.imageUri && !isDeleted && styles.bubbleImage,
          ]}
        >
          {bubbleBody}
          {timeLabel ? (
            <Text style={isDeleted ? styles.bubbleTimeDeleted : styles.bubbleTimeOther}>
              {timeLabel}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function resolveOwnShopId(shop) {
  const raw = shop?.shopId || shop?.id || shop?._id;
  return raw ? String(raw) : null;
}

function isMongoObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ''));
}

function isShopPeer(peer) {
  if (!peer) {
    return false;
  }

  const peerType = String(peer.peerType || '').toLowerCase();
  if (peerType === 'shop') {
    return true;
  }
  if (peerType === 'user') {
    return false;
  }

  const peerId = String(peer.id || '').trim();
  const ownerUserId = String(peer.ownerUserId || '').trim();
  return Boolean(peerId && ownerUserId && peerId !== ownerUserId);
}

function resolvePeerShopId(peer, shopIdProp = '', overlayId = '') {
  const explicit = String(shopIdProp || overlayId || '').trim();
  if (explicit && isMongoObjectId(explicit)) {
    return explicit;
  }

  if (!isShopPeer(peer)) {
    return '';
  }

  const fromPeer = String(peer.shopId || peer.id || '').trim();
  return fromPeer && isMongoObjectId(fromPeer) ? fromPeer : '';
}

function resolvePeerUserId(peer, buyerId = '') {
  const fromBuyer = String(buyerId || '').trim();
  if (fromBuyer && isMongoObjectId(fromBuyer)) {
    return fromBuyer;
  }

  if (!peer) {
    return '';
  }

  if (isShopPeer(peer)) {
    const ownerUserId = String(peer.ownerUserId || peer.userId || '').trim();
    return ownerUserId && isMongoObjectId(ownerUserId) ? ownerUserId : '';
  }

  const userId = String(peer.userId || peer.id || '').trim();
  return userId && isMongoObjectId(userId) ? userId : '';
}

export default function ChatScreen({
  mode = 'buyer',
  conversationId,
  shopId,
  shopName,
  buyerId,
  buyerName,
  buyerAvatar,
  onBack,
  onViewShop,
  onConversationPreviewChange,
}) {
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const suppressKeyboardHideRef = useRef(false);
  const authUser = useSelector(selectAuthUser);
  const authProfile = useSelector(selectAuthProfile);
  const isSellerAccount = useSelector(selectIsSeller);
  const mongoUserId = authProfile?.mongoUserId || '';
  const screenInsets = useScreenInsets();
  const hasShopContext = Boolean(String(shopId || '').trim());
  const isSellerMode =
    mode === 'seller' || Boolean(buyerId) || (isSellerAccount && !hasShopContext);

  const [resolvedConversationId, setResolvedConversationId] = useState(
    isRealConversationId(conversationId) ? String(conversationId) : null
  );
  const [messages, setMessages] = useState([]);
  const [sequence, setSequence] = useState(null);
  const [ownShopId, setOwnShopId] = useState(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [peer, setPeer] = useState(null);
  const [peerOverlay, setPeerOverlay] = useState(null);
  const [buyerProfileUserId, setBuyerProfileUserId] = useState('');
  const [overlayStoreId, setOverlayStoreId] = useState('');

  const { keyboardInset, composerBottom, isKeyboardVisible, isWindowResized, keyboardGap } =
    useKeyboardInset({
      suppressHideRef: suppressKeyboardHideRef,
    });

  const displayName = useMemo(() => {
    const peerIsShop = isShopPeer(peer) || hasShopContext;
    if (peerIsShop) {
      return peer?.name || peer?.shopName || shopName || 'Gian hàng';
    }
    return peer?.fullName || peer?.name || buyerName || 'Người dùng';
  }, [buyerName, hasShopContext, peer, shopName]);

  const peerIsShop = isShopPeer(peer) || hasShopContext;

  const resolvedStoreId = useMemo(
    () => resolvePeerShopId(peer, shopId, overlayStoreId),
    [overlayStoreId, peer, shopId]
  );

  const accountPeer = useMemo(() => {
    const resolveAvatar = (...values) => {
      for (const value of values) {
        const url = String(value || '').trim();
        if (url && url !== 'null' && url !== 'undefined') {
          return url;
        }
      }
      return '';
    };

    if (peerIsShop) {
      return {
        id: peer?.id || shopId || '',
        fullName: peer?.fullName || peer?.name || 'Người dùng',
        userName: peer?.userName || '',
        avatar: resolveAvatar(peer?.accountAvatar, peer?.photoUrl),
        accountAvatar: resolveAvatar(peer?.accountAvatar, peer?.photoUrl),
        followersCount: Number(peer?.followersCount) || 0,
        followingCount: Number(peer?.followingCount) || 0,
        isOnline: Boolean(peer?.accountIsOnline ?? peer?.isOnline),
        lastActiveAt: peer?.accountLastActiveAt || peer?.lastActiveAt,
        activityLabel: peer?.accountActivityLabel || peer?.activityLabel,
        shopName: peer?.shopName || shopName || '',
      };
    }

    return {
      id: peer?.id || buyerId || '',
      fullName: peer?.fullName || peer?.name || buyerName || 'Người dùng',
      userName: peer?.userName || '',
      avatar: resolveAvatar(peer?.avatar, peer?.photoUrl, buyerAvatar),
      followersCount: Number(peer?.followersCount) || 0,
      followingCount: Number(peer?.followingCount) || 0,
      isOnline: Boolean(peer?.isOnline),
      lastActiveAt: peer?.lastActiveAt,
      activityLabel: peer?.activityLabel,
    };
  }, [buyerAvatar, buyerId, buyerName, peer, peerIsShop, shopId, shopName]);

  function handleOpenPeer() {
    const storeId = resolvePeerShopId(peer, shopId, overlayStoreId);
    if (peerIsShop && storeId) {
      setOverlayStoreId(storeId);
      setPeerOverlay('store');
      return;
    }

    const userId = resolvePeerUserId(peer, buyerId);
    if (userId) {
      setBuyerProfileUserId(userId);
      setPeerOverlay('buyer-profile');
    }
  }

  const peerAvatarUri = isRemoteAvatarUrl(peer?.avatar)
    ? String(peer.avatar).trim()
    : isRemoteAvatarUrl(peer?.accountAvatar)
      ? String(peer.accountAvatar).trim()
      : isRemoteAvatarUrl(buyerAvatar)
        ? String(buyerAvatar).trim()
        : '';
  const activityStatus = peer?.isOnline
    ? 'Đang hoạt động'
    : peer?.activityLabel || formatActivityLabel(peer?.isOnline, peer?.lastActiveAt);
  const sequenceLabel = formatSequenceLabel(sequence);
  const viewerContext = useMemo(
    () => ({
      isSellerMode,
      userId: mongoUserId,
      shopId: ownShopId,
    }),
    [isSellerMode, mongoUserId, ownShopId]
  );
  const chatItems = useMemo(() => buildChatListItems(messages), [messages]);

  const canSend =
    draft.trim().length > 0 && !isSending && Boolean(resolvedConversationId || shopId || conversationId);

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const usesFlexComposer = Platform.OS === 'android';

  const listContentPaddingBottom = usesFlexComposer
    ? 12
    : COMPOSER_BAR_ESTIMATE +
      (isKeyboardVisible
        ? isWindowResized
          ? keyboardGap
          : Math.max(keyboardInset, keyboardGap)
        : screenInsets.bottomSpacing) +
      8;

  /** Android: composer nằm trong flex column, adjustResize tự đẩy — không offset thêm. */
  const composerBottomOffset =
    !usesFlexComposer && isKeyboardVisible ? composerBottom : 0;
  const composerBottomPadding =
    !usesFlexComposer && !isKeyboardVisible ? screenInsets.bottomSpacing : 0;
  const composerSafePadding =
    usesFlexComposer && !isKeyboardVisible ? screenInsets.bottomSpacing : 0;
  /** Chỉ khi Android overlay thật (không resize): đệm body để composer không bị che. */
  const chatBodyKeyboardPad =
    usesFlexComposer && isKeyboardVisible && !isWindowResized ? composerBottom : 0;

  useEffect(() => {
    if (isKeyboardVisible) {
      suppressKeyboardHideRef.current = false;
      scrollToEnd(false);
    }
  }, [isKeyboardVisible, keyboardInset, scrollToEnd]);

  const ensureConversation = useCallback(async () => {
    if (resolvedConversationId) {
      return resolvedConversationId;
    }

    if (isSellerMode) {
      if (!isRealConversationId(conversationId)) {
        throw new Error('Không tìm thấy cuộc trò chuyện.');
      }
      setResolvedConversationId(String(conversationId));
      return String(conversationId);
    }

    if (!shopId) {
      throw new Error('Không tìm thấy gian hàng để nhắn tin.');
    }

    const result = await startBuyerConversationOnBackend({
      shopId,
      shopName: shopName || 'Gian hàng',
    });
    const nextId = String(result.conversationId || '');
    if (!nextId) {
      throw new Error('Không tạo được cuộc trò chuyện.');
    }

    if (result.shop) {
      setPeer(result.shop);
    }

    setResolvedConversationId(nextId);
    return nextId;
  }, [conversationId, isSellerMode, resolvedConversationId, shopId, shopName]);

  useEffect(() => {
    if (isRealConversationId(conversationId)) {
      setResolvedConversationId(String(conversationId));
    }
  }, [conversationId]);

  const loadPeer = useCallback(
    async (activeConversationId) => {
      if (!activeConversationId) {
        return;
      }

      try {
        if (isSellerMode) {
          const idToken = await getCurrentUserIdToken();
          const nextPeer = await getSellerConversationPeerOnBackend(idToken, activeConversationId);
          setPeer(nextPeer);
          return;
        }

        const nextPeer = await getBuyerConversationPeerOnBackend(activeConversationId);
        setPeer(nextPeer);
      } catch {
        // Peer info is optional for chat rendering.
      }
    },
    [isSellerMode]
  );

  const loadMessages = useCallback(async () => {
    setIsLoading(true);

    try {
      let activeConversationId = resolvedConversationId;

      if (!activeConversationId && isRealConversationId(conversationId)) {
        activeConversationId = String(conversationId);
        setResolvedConversationId(activeConversationId);
      }

      // Buyer mở chat từ shop/product: tạo/resolve conversation sớm để lấy avatar + presence.
      if (!activeConversationId && !isSellerMode && shopId) {
        activeConversationId = await ensureConversation();
      }

      if (!activeConversationId && isSellerMode) {
        activeConversationId = await ensureConversation();
      }

      if (!activeConversationId) {
        setMessages([]);
        setSequence(null);
        setIsLoading(false);
        return;
      }

      let activeShopId = ownShopId;
      let result = { messages: [], sequence: null };

      if (isSellerMode) {
        const idToken = await getCurrentUserIdToken();
        if (!activeShopId) {
          const shop = await getSellerShopSettingsOnBackend(idToken);
          activeShopId = resolveOwnShopId(shop);
          setOwnShopId(activeShopId);
        }
        result = await getSellerMessagesOnBackend(idToken, activeConversationId);
      } else {
        result = await getBuyerMessagesOnBackend(activeConversationId);
      }

      setMessages(
        markMessagesFromServer(
          normalizeMessages(
            Array.isArray(result?.messages) ? result.messages : [],
            viewerContext,
            { trustServer: true }
          )
        )
      );
      setSequence(result?.sequence || null);
      await loadPeer(activeConversationId);
    } catch (loadError) {
      setMessages([]);
      setSequence(null);
      showErrorAlert(loadError.message || 'Không tải được tin nhắn.');
    } finally {
      setIsLoading(false);
    }
  }, [
    conversationId,
    ensureConversation,
    isSellerMode,
    loadPeer,
    ownShopId,
    resolvedConversationId,
    shopId,
    viewerContext,
  ]);

  useEffect(() => {
    if (!isSellerMode) {
      setOwnShopId(null);
      return;
    }

    if (ownShopId) {
      return;
    }

    let cancelled = false;

    async function loadOwnShop() {
      try {
        const idToken = await getCurrentUserIdToken();
        const shop = await getSellerShopSettingsOnBackend(idToken);
        if (!cancelled) {
          setOwnShopId(resolveOwnShopId(shop));
        }
      } catch {
        if (!cancelled) {
          setOwnShopId(null);
        }
      }
    }

    loadOwnShop();

    return () => {
      cancelled = true;
    };
  }, [isSellerMode, ownShopId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!isLoading && chatItems.length > 0) {
      scrollToEnd();
    }
  }, [chatItems.length, isLoading, scrollToEnd]);

  const bumpSequence = useCallback((thuTu, shouldIncrement = true) => {
    if (!thuTu) {
      return;
    }

    setSequence((current) => ({
      from: current?.from ? Math.min(current.from, thuTu) : thuTu,
      to: current?.to ? Math.max(current.to, thuTu) : thuTu,
      total: shouldIncrement ? (current?.total || 0) + 1 : current?.total || 0,
      count: shouldIncrement ? (current?.count || 0) + 1 : current?.count || 0,
    }));
  }, []);

  useChatSocket({
    conversationId: resolvedConversationId,
    enabled: Boolean(resolvedConversationId),
    onMessageNew: (payload) => {
      if (!payload?.message) {
        return;
      }

      const normalized = applyMessageViewerContext(payload.message, viewerContext);
      if (normalized.isMine) {
        return;
      }

      setMessages((current) => {
        const alreadyExists = current.some(
          (item) => String(item.id) === String(normalized.id)
        );
        const next = mergeMessages(current, normalized);
        if (!alreadyExists) {
          bumpSequence(normalized.thuTu, true);
        }
        return next;
      });
      scrollToEnd();
    },
    onMessageRead: (payload) => {
      if (!payload?.messageIds?.length) {
        return;
      }
      const idSet = new Set(payload.messageIds.map(String));
      setMessages((current) =>
        current.map((item) =>
          idSet.has(String(item.id)) ? { ...item, status: 'seen' } : item
        )
      );
    },
    onMessageDeleted: (payload) => {
      if (!payload?.message) {
        return;
      }
      setMessages((current) =>
        mergeMessages(current, applyMessageViewerContext(payload.message, viewerContext))
      );
    },
    onPresenceUpdate: (payload) => {
      setPeer((current) => {
        if (!current) {
          return current;
        }

        const expectedTarget = isSellerMode ? 'user' : 'shop';
        if (payload?.target && payload.target !== expectedTarget) {
          // Buyer: cập nhật luôn trạng thái tài khoản chủ shop nếu nhận user presence.
          if (
            !isSellerMode &&
            payload.target === 'user' &&
            payload?.userId &&
            (String(current.ownerUserId || '') === String(payload.userId) ||
              String(current.userId || '') === String(payload.userId))
          ) {
            return {
              ...current,
              accountIsOnline: payload.isOnline,
              accountLastActiveAt: payload.lastActiveAt,
              accountActivityLabel: payload.activityLabel,
              // Fallback khi chưa có shop presence.
              isOnline: current.isOnline || Boolean(payload.isOnline),
              lastActiveAt: current.lastActiveAt || payload.lastActiveAt,
              activityLabel: current.isOnline
                ? current.activityLabel
                : payload.activityLabel || current.activityLabel,
            };
          }
          return current;
        }

        const matchesPeer = isSellerMode
          ? payload?.userId && String(current.id) === String(payload.userId)
          : (payload?.shopId && String(current.id) === String(payload.shopId)) ||
            (payload?.userId &&
              (String(current.ownerUserId || '') === String(payload.userId) ||
                String(current.userId || '') === String(payload.userId)));

        if (!matchesPeer) {
          return current;
        }

        if (isSellerMode) {
          return {
            ...current,
            isOnline: payload.isOnline,
            lastActiveAt: payload.lastActiveAt,
            activityLabel: payload.activityLabel,
          };
        }

        return {
          ...current,
          isOnline: payload.isOnline,
          lastActiveAt: payload.lastActiveAt,
          activityLabel: payload.activityLabel,
          accountIsOnline:
            payload.target === 'shop' ? current.accountIsOnline : payload.isOnline,
          accountLastActiveAt:
            payload.target === 'shop' ? current.accountLastActiveAt : payload.lastActiveAt,
          accountActivityLabel:
            payload.target === 'shop' ? current.accountActivityLabel : payload.activityLabel,
        };
      });
    },
  });

  // Làm mới avatar + presence định kỳ khi đang mở chat.
  useEffect(() => {
    if (!resolvedConversationId) {
      return undefined;
    }

    const timer = setInterval(() => {
      loadPeer(resolvedConversationId);
    }, 20000);

    return () => clearInterval(timer);
  }, [loadPeer, resolvedConversationId]);

  async function sendImageMessage(image) {
    if (!image) {
      return;
    }

    const { uri, imageContent } = buildChatImagePayload(image);
    const optimistic = {
      ...createLocalMessage('', { imageUri: uri, status: 'sent' }),
      isMine: true,
    };
    setMessages((current) => upsertMessage(current, optimistic));
    scrollToEnd();
    setIsSending(true);

    try {
      const activeConversationId = await ensureConversation();
      let message;

      if (isSellerMode) {
        const idToken = await getCurrentUserIdToken();
        message = await sendSellerMessageOnBackend({
          idToken,
          conversationId: activeConversationId,
          imageContent,
        });
      } else {
        message = await sendBuyerMessageOnBackend({
          conversationId: activeConversationId,
          imageContent,
        });
      }

      setMessages((current) =>
        upsertMessage(
          current,
          {
            ...message,
            fromServer: true,
            imageUri: message.imageUri || uri,
          },
          {
            removePending: true,
            pendingId: optimistic.id,
          }
        )
      );
      bumpSequence(message?.thuTu);
    } catch (pickError) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      showErrorAlert(pickError.message || 'Không gửi được ảnh.');
    } finally {
      setIsSending(false);
    }
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }

    setIsSending(true);
    suppressKeyboardHideRef.current = true;
    const optimistic = {
      ...createLocalMessage(content),
      isMine: true,
    };
    setMessages((current) => upsertMessage(current, optimistic));
    setDraft('');
    scrollToEnd();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      setTimeout(() => {
        suppressKeyboardHideRef.current = false;
      }, 250);
    });

    try {
      const activeConversationId = await ensureConversation();
      let message;

      if (isSellerMode) {
        const idToken = await getCurrentUserIdToken();
        message = await sendSellerMessageOnBackend({
          idToken,
          conversationId: activeConversationId,
          content,
        });
      } else {
        message = await sendBuyerMessageOnBackend({
          conversationId: activeConversationId,
          content,
        });
      }

      setMessages((current) =>
        upsertMessage(
          current,
          {
            ...message,
            fromServer: true,
          },
          {
            removePending: true,
            pendingId: optimistic.id,
          }
        )
      );
      bumpSequence(message?.thuTu, true);
    } catch (sendError) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(content);
      showErrorAlert(sendError.message || 'Không gửi được tin nhắn.');
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      setTimeout(() => {
        suppressKeyboardHideRef.current = false;
      }, 250);
    }
  }

  async function handlePickImage() {
    try {
      const image = await pickChatImageFromLibrary();
      await sendImageMessage(image);
    } catch (pickError) {
      showErrorAlert(pickError.message || 'Không gửi được ảnh.');
    }
  }

  async function handleAttachMenu() {
    try {
      const image = await chooseChatImageSource();
      await sendImageMessage(image);
    } catch (pickError) {
      showErrorAlert(pickError.message || 'Không gửi được ảnh.');
    }
  }

  function handleLongPressMessage(item) {
    if (!item.isMine || item.isDeleted) {
      return;
    }

    Alert.alert('Tin nhắn', 'Bạn muốn gỡ tin nhắn này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Gỡ tin nhắn',
        style: 'destructive',
        onPress: async () => {
          try {
            const activeConversationId = resolvedConversationId || (await ensureConversation());
            let result;

            if (isSellerMode) {
              const idToken = await getCurrentUserIdToken();
              result = await deleteSellerMessageOnBackend(
                idToken,
                activeConversationId,
                item.id
              );
            } else {
              result = await deleteBuyerMessageOnBackend(activeConversationId, item.id);
            }

            const deleted = result?.message || result;
            const ownName = isSellerMode
              ? shopName || 'Người bán'
              : authProfile?.fullName || authUser?.displayName || 'Người mua';
            const preview =
              result?.lastMessage ||
              deleted?.conversationLastMessage ||
              `${ownName} đã gỡ 1 tin nhắn`;
            setMessages((current) => mergeMessages(current, deleted));
            onConversationPreviewChange?.(activeConversationId, preview);
          } catch (deleteError) {
            showErrorAlert(deleteError.message || 'Không gỡ được tin nhắn.');
          }
        },
      },
    ]);
  }

  if (peerOverlay === 'buyer-profile' && buyerProfileUserId) {
    return (
      <BuyerProfileScreen
        userId={buyerProfileUserId}
        onBack={() => {
          setPeerOverlay(null);
          setBuyerProfileUserId('');
          setOverlayStoreId('');
        }}
        onOpenShop={(nextShopId) => {
          setOverlayStoreId(String(nextShopId));
          setPeerOverlay('store');
        }}
        onOpenUser={(nextUserId) => setBuyerProfileUserId(String(nextUserId))}
      />
    );
  }

  if (peerOverlay === 'account' && accountPeer) {
    return (
      <ChatProfileScreen
        peer={accountPeer}
        peerType="shop"
        onBack={() => setPeerOverlay(null)}
        onViewShop={
          resolvedStoreId
            ? () => {
                setOverlayStoreId(resolvedStoreId);
                setPeerOverlay('store');
              }
            : undefined
        }
      />
    );
  }

  if (peerOverlay === 'store' && resolvedStoreId) {
    return (
      <StoreDetailScreen
        storeId={resolvedStoreId}
        onBack={() => {
          if (buyerProfileUserId) {
            setOverlayStoreId('');
            setPeerOverlay('buyer-profile');
            return;
          }
          setOverlayStoreId('');
          setPeerOverlay(null);
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <SubScreenHeader
        onBack={onBack}
        centerSlot={
          <Pressable
            onPress={handleOpenPeer}
            style={({ pressed }) => [styles.headerInfo, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={
              peerIsShop ? `Xem gian hàng ${displayName}` : `Xem tài khoản ${displayName}`
            }
          >
            <View style={styles.headerAvatarWrap}>
              <AvatarBadge name={displayName} uri={peerAvatarUri} size={40} />
              {peer?.isOnline ? <View style={styles.onlineDot} /> : null}
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title} numberOfLines={1}>
                {displayName}
              </Text>
              <Text
                style={[styles.activityStatus, peer?.isOnline && styles.activityOnline]}
                numberOfLines={1}
              >
                {activityStatus}
              </Text>
            </View>
          </Pressable>
        }
      />

      <View style={[styles.chatBody, chatBodyKeyboardPad > 0 && { paddingBottom: chatBodyKeyboardPad }]}>
        {sequenceLabel ? <Text style={styles.sequenceText}>{sequenceLabel}</Text> : null}

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#076F32" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.list}
            data={chatItems}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={[styles.listContent, { paddingBottom: listContentPaddingBottom }]}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onContentSizeChange={() => {
              if (isKeyboardVisible) {
                scrollToEnd(false);
              }
            }}
            renderItem={({ item }) => {
              if (item.type === 'date') {
                return <DateSeparator label={item.label} />;
              }

              return (
                <ChatBubble
                  item={item.message}
                  peerAvatarUri={peerAvatarUri}
                  peerName={displayName}
                  onLongPress={handleLongPressMessage}
                />
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Chưa có tin nhắn. Hãy gửi lời chào.</Text>
            }
          />
        )}

        <View
          style={[
            styles.composer,
            !usesFlexComposer && styles.composerDocked,
            !usesFlexComposer && {
              bottom: composerBottomOffset,
              paddingBottom: composerBottomPadding,
            },
            composerSafePadding > 0 && { paddingBottom: composerSafePadding },
          ]}
        >
          <Pressable
            onPress={handleAttachMenu}
            disabled={isSending}
            style={({ pressed }) => [styles.roundActionButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.roundActionText}>+</Text>
          </Pressable>

          <Pressable
            onPress={handlePickImage}
            disabled={isSending}
            style={({ pressed }) => [styles.roundActionButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.roundActionText}>🖼</Text>
          </Pressable>

          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
            }}
            onFocus={() => scrollToEnd()}
            onBlur={() => {
              if (suppressKeyboardHideRef.current) {
                return;
              }
            }}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#94a3b8"
            style={styles.input}
            multiline
            blurOnSubmit={false}
            returnKeyType="default"
          />

          <Pressable
            disabled={!canSend}
            onPress={handleSend}
            onPressIn={() => inputRef.current?.focus()}
            style={({ pressed }) => [
              styles.sendButton,
              canSend ? styles.sendButtonActive : styles.sendButtonDisabled,
              pressed && canSend && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.sendButtonText, !canSend && styles.sendButtonTextDisabled]}>
              {isSending ? '…' : '➤'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6f8' },
  chatBody: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
  },
  list: { flex: 1 },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  headerAvatarWrap: {
    position: 'relative',
    marginRight: 10,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: { width: '100%', height: '100%' },
  headerAvatarText: { color: '#0f172a', fontSize: 17, fontWeight: '900' },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  title: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  activityStatus: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  activityOnline: { color: '#076F32' },
  sequenceText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
  },
  listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 },
  dateSeparatorWrap: {
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  dateSeparatorPill: {
    backgroundColor: '#e8edf2',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  dateSeparatorText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  messageRow: { marginBottom: 12, maxWidth: '82%' },
  messageRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  messageRowOtherWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    maxWidth: '88%',
    marginBottom: 12,
    gap: 8,
  },
  peerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#076F32',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    overflow: 'hidden',
  },
  peerAvatarImage: { width: '100%', height: '100%' },
  peerAvatarText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  messageRowOther: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: '#076F32', borderBottomRightRadius: 6 },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderBottomLeftRadius: 6,
  },
  bubbleDeleted: {
    backgroundColor: '#e8edf3',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderBottomRightRadius: 6,
  },
  bubbleText: { color: '#0f172a', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  bubbleTextMine: { color: '#ffffff' },
  deletedText: { color: '#475569', fontStyle: 'italic', fontWeight: '600' },
  bubbleImage: { padding: 4, overflow: 'hidden' },
  bubbleMetaMine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '600',
  },
  bubbleTimeOther: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  bubbleTimeDeleted: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  imageMessageWrap: { maxWidth: 220 },
  chatImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  imageCaption: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: '#0f172a',
    fontWeight: '500',
  },
  messageStatus: { fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e8edf2',
    backgroundColor: '#ffffff',
  },
  composerDocked: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
    elevation: 8,
  },
  roundActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  roundActionText: { fontSize: 18, color: '#334155', fontWeight: '700' },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: { backgroundColor: '#076F32' },
  sendButtonDisabled: { backgroundColor: '#e2e8f0' },
  sendButtonText: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  sendButtonTextDisabled: { color: '#94a3b8' },
  buttonPressed: { opacity: 0.85 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  errorText: {
    color: '#b45309',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontWeight: '700',
    backgroundColor: '#fffbeb',
  },
});
