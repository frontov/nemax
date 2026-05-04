"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import {
  decryptMessageText,
  encryptMessageText,
  getStoredFamilyKey,
  storeFamilyKeyFromLocationHash,
} from "@/lib/e2e-crypto";
import { websocketClient } from "@/lib/websocket";

type ChatMessage = {
  id: string;
  familyId: string;
  senderUserId: string;
  text: string | null;
  createdAt: string;
  attachments: ChatAttachment[];
  readByUserIds?: string[];
  replyToMessage?: {
    id: string;
    text: string | null;
    attachments?: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: string;
      url: string;
    }>;
    sender: {
      id: string;
      displayName: string;
    };
  } | null;
  sender: {
    id: string;
    displayName: string;
  };
};

type ChatAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  width?: number | null;
  height?: number | null;
  url: string;
};

type MePayload = {
  user: {
    id: string;
  };
  family?: {
    id: string;
    name: string;
  } | null;
  member?: {
    id: string;
    role: string;
  } | null;
};

type DeletedMessagePayload = {
  id: string;
  familyId: string;
  deletedAt: string;
};

type MessageReadPayload = {
  familyId: string;
  userId: string;
  messageId: string;
  lastReadAt: string;
};

type ChatMessagesResponse = {
  messages: ChatMessage[];
  viewerLastReadMessageId: string | null;
  page: {
    olderCursor: string | null;
    newerCursor: string | null;
  };
};

const senderPalette = [
  "peach",
  "mint",
  "sky",
  "sand",
  "rose",
  "lavender",
] as const;

const quickEmojis = ["❤️", "👍", "😂", "🙏", "🔥", "🥹", "🎉", "😘"] as const;

function getSenderTone(senderId: string) {
  let hash = 0;

  for (let index = 0; index < senderId.length; index += 1) {
    hash = (hash * 31 + senderId.charCodeAt(index)) >>> 0;
  }

  return senderPalette[hash % senderPalette.length];
}

function getInitials(displayName: string) {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date(value));
}

function getDayKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getAttachmentDisplayAspectRatio(attachment: ChatAttachment, isSingle: boolean) {
  if (!attachment.width || !attachment.height) {
    return isSingle ? "4 / 3" : "1 / 1";
  }

  const sourceRatio = attachment.width / attachment.height;
  const normalizedRatio = isSingle ? clamp(sourceRatio, 0.72, 1.6) : clamp(sourceRatio, 0.82, 1.25);

  return `${normalizedRatio}`;
}

function isNearBottom(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 72;
}

function buildReplyPreview(message: {
  text: string | null;
  attachments?: Array<unknown>;
}) {
  const preview = (message.text ?? "").trim();

  if (!preview && message.attachments?.length) {
    return "Изображение";
  }

  if (!preview) {
    return "Сообщение без текста";
  }

  return preview.length > 90 ? `${preview.slice(0, 90)}…` : preview;
}

async function decryptChatMessage(message: ChatMessage, familyKey: string | null): Promise<ChatMessage> {
  const text = await decryptMessageText(message.text, familyKey).catch(() => "🔒 Не удалось расшифровать сообщение");
  const replyText = message.replyToMessage
    ? await decryptMessageText(message.replyToMessage.text, familyKey).catch(
        () => "🔒 Не удалось расшифровать сообщение",
      )
    : null;

  return {
    ...message,
    attachments: message.attachments ?? [],
    text: text ?? null,
    replyToMessage: message.replyToMessage
      ? {
          ...message.replyToMessage,
          attachments: message.replyToMessage.attachments ?? [],
          text: replyText ?? null,
        }
      : null,
  };
}

async function decryptChatMessages(messages: ChatMessage[], familyKey: string | null) {
  return Promise.all(messages.map((message) => decryptChatMessage(message, familyKey)));
}

export function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);
  const [canDeleteMessages, setCanDeleteMessages] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [familyKey, setFamilyKey] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [newerCursor, setNewerCursor] = useState<string | null>(null);
  const [viewerLastReadMessageId, setViewerLastReadMessageId] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);
  const [lightbox, setLightbox] = useState<{
    attachments: ChatAttachment[];
    index: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const familyKeyRef = useRef<string | null>(null);
  const lastMarkedReadIdRef = useRef<string | null>(null);
  const initialScrollTargetMessageIdRef = useRef<string | null>(null);
  const initialScrollAppliedRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);

  const groupedMessages = useMemo(
    () =>
      messages.reduce<
        Array<{
          sender: ChatMessage["sender"];
          tone: ReturnType<typeof getSenderTone>;
          isOwn: boolean;
          dayKey: string;
          dayLabel: string;
          items: ChatMessage[];
        }>
      >((groups, message) => {
        const isOwn = message.sender.id === currentUserId;
        const dayKey = getDayKey(message.createdAt);
        const lastGroup = groups[groups.length - 1];

        if (
          lastGroup &&
          lastGroup.sender.id === message.sender.id &&
          lastGroup.dayKey === dayKey
        ) {
          lastGroup.items.push(message);
          return groups;
        }

        groups.push({
          sender: message.sender,
          tone: getSenderTone(message.sender.id),
          isOwn,
          dayKey,
          dayLabel: formatDayLabel(message.createdAt),
          items: [message],
        });

        return groups;
      }, []),
    [messages, currentUserId],
  );

  const firstUnreadMessageId = useMemo(() => {
    if (!currentUserId || messages.length === 0) {
      return null;
    }

    const firstIncomingMessage = messages.find((message) => message.senderUserId !== currentUserId);

    if (!viewerLastReadMessageId) {
      return firstIncomingMessage?.id ?? null;
    }

    const lastReadIndex = messages.findIndex((message) => message.id === viewerLastReadMessageId);

    if (lastReadIndex < 0) {
      return firstIncomingMessage?.id ?? null;
    }

    return (
      messages.slice(lastReadIndex + 1).find((message) => message.senderUserId !== currentUserId)?.id ?? null
    );
  }, [messages, currentUserId, viewerLastReadMessageId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  function mergeMessage(current: ChatMessage[], message: ChatMessage) {
    const existingIndex = current.findIndex((item) => item.id === message.id);

    if (existingIndex >= 0) {
      const next = [...current];
      next[existingIndex] = {
        ...next[existingIndex],
        ...message,
      };
      return next;
    }

    return [...current, message];
  }

  function mergeMessagePages(current: ChatMessage[], incoming: ChatMessage[]) {
    const merged = [...current];

    for (const message of incoming) {
      const existingIndex = merged.findIndex((item) => item.id === message.id);

      if (existingIndex >= 0) {
        merged[existingIndex] = {
          ...merged[existingIndex],
          ...message,
        };
        continue;
      }

      merged.push(message);
    }

    merged.sort((left, right) => {
      const timeDelta = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

      if (timeDelta !== 0) {
        return timeDelta;
      }

      return left.id.localeCompare(right.id);
    });

    return merged;
  }

  function appendMessage(message: ChatMessage) {
    if (scrollRef.current) {
      shouldAutoScrollRef.current = isNearBottom(scrollRef.current);
    }

    void decryptChatMessage(message, familyKeyRef.current).then((decryptedMessage) => {
      setMessages((current) => mergeMessage(current, decryptedMessage));
    });
  }

  function applyReadReceipt(current: ChatMessage[], payload: MessageReadPayload) {
    const readIndex = current.findIndex((message) => message.id === payload.messageId);

    if (readIndex < 0) {
      return current;
    }

    return current.map((message, index) => {
      if (index > readIndex || message.senderUserId === payload.userId) {
        return message;
      }

      const readByUserIds = Array.from(new Set([...(message.readByUserIds ?? []), payload.userId]));
      return {
        ...message,
        readByUserIds,
      };
    });
  }

  async function requestMessages(query?: Record<string, string | number | undefined>) {
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      search.set(key, String(value));
    }

    const path = search.size > 0 ? `/messages?${search.toString()}` : "/messages";
    return apiClient.request<ChatMessagesResponse>({ path });
  }

  async function refreshMessages() {
    if (isRefreshingRef.current) {
      return null;
    }

    const latestLoadedMessageId = messagesRef.current.at(-1)?.id;

    if (!latestLoadedMessageId) {
      return null;
    }

    isRefreshingRef.current = true;

    try {
      const payload = await requestMessages({
        afterMessageId: latestLoadedMessageId,
        take: 40,
      });
      const decryptedMessages = await decryptChatMessages(payload.messages, familyKeyRef.current);

      if (decryptedMessages.length > 0) {
        setMessages((current) => mergeMessagePages(current, decryptedMessages));
      }

      setViewerLastReadMessageId(payload.viewerLastReadMessageId);
      setNewerCursor(payload.page.newerCursor);

      return {
        messages: decryptedMessages,
        viewerLastReadMessageId: payload.viewerLastReadMessageId,
      };
    } finally {
      isRefreshingRef.current = false;
    }
  }

  async function loadOlderMessages() {
    if (!olderCursor || loadingOlder) {
      return;
    }

    const scrollElement = scrollRef.current;
    const previousScrollHeight = scrollElement?.scrollHeight ?? 0;
    setLoadingOlder(true);

    try {
      const payload = await requestMessages({
        beforeMessageId: olderCursor,
        take: 40,
      });
      const decryptedMessages = await decryptChatMessages(payload.messages, familyKeyRef.current);

      if (decryptedMessages.length === 0) {
        setOlderCursor(null);
        return;
      }

      setMessages((current) => mergeMessagePages(current, decryptedMessages));
      setOlderCursor(payload.page.olderCursor);
      setViewerLastReadMessageId(payload.viewerLastReadMessageId);

      requestAnimationFrame(() => {
        if (!scrollElement) {
          return;
        }

        const nextScrollHeight = scrollElement.scrollHeight;
        scrollElement.scrollTop += nextScrollHeight - previousScrollHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  }

  async function loadNewerMessages() {
    if (!newerCursor || loadingNewer) {
      return;
    }

    setLoadingNewer(true);

    try {
      const payload = await requestMessages({
        afterMessageId: newerCursor,
        take: 40,
      });
      const decryptedMessages = await decryptChatMessages(payload.messages, familyKeyRef.current);

      if (decryptedMessages.length > 0) {
        setMessages((current) => mergeMessagePages(current, decryptedMessages));
      }

      setNewerCursor(payload.page.newerCursor);
      setViewerLastReadMessageId(payload.viewerLastReadMessageId);
    } finally {
      setLoadingNewer(false);
    }
  }

  async function markMessageRead(messageId: string) {
    if (!messageId || lastMarkedReadIdRef.current === messageId) {
      return;
    }

    lastMarkedReadIdRef.current = messageId;

    try {
      await apiClient.request({
        path: "/reads",
        method: "POST",
        body: JSON.stringify({ messageId }),
      });
      setViewerLastReadMessageId(messageId);
    } catch {
      lastMarkedReadIdRef.current = null;
    }
  }

  function markLatestVisibleMessageAsRead(sourceMessages: ChatMessage[]) {
    if (!currentUserId) {
      return;
    }

    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    if (!scrollRef.current || !isNearBottom(scrollRef.current)) {
      return;
    }

    const latestIncomingMessage = [...sourceMessages]
      .reverse()
      .find((message) => message.senderUserId !== currentUserId);

    if (!latestIncomingMessage) {
      return;
    }

    void markMessageRead(latestIncomingMessage.id);
  }

  useEffect(() => {
    const hashKey = storeFamilyKeyFromLocationHash();
    familyKeyRef.current = hashKey ?? getStoredFamilyKey();
    setFamilyKey(familyKeyRef.current);

    void Promise.all([
      apiClient.request<MePayload>({ path: "/auth/me" }),
      requestMessages({ take: 40 }),
    ])
      .then(async ([mePayload, messagesPayload]) => {
        setCurrentUserId(mePayload.user.id);
        setActiveFamilyId(mePayload.family?.id ?? null);
        setCanDeleteMessages(mePayload.member?.role === "owner");

        const decryptedMessages = await decryptChatMessages(messagesPayload.messages, familyKeyRef.current);
        setMessages(decryptedMessages);

        const lastMessageId = decryptedMessages.at(-1)?.id ?? null;
        const initialTargetMessageId =
          messagesPayload.viewerLastReadMessageId &&
          messagesPayload.viewerLastReadMessageId !== lastMessageId
            ? messagesPayload.viewerLastReadMessageId
            : null;

        initialScrollTargetMessageIdRef.current = initialTargetMessageId;
        initialScrollAppliedRef.current = false;
        shouldAutoScrollRef.current = !initialTargetMessageId;
        setOlderCursor(messagesPayload.page.olderCursor);
        setNewerCursor(messagesPayload.page.newerCursor);
        setViewerLastReadMessageId(messagesPayload.viewerLastReadMessageId);
      })
      .catch((reason) =>
        {
          setCurrentUserId(null);
          setActiveFamilyId(null);
          setCanDeleteMessages(false);
          setError(reason instanceof Error ? reason.message : "Не удалось загрузить сообщения");
        },
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeFamilyId) {
      return;
    }

    const socket = websocketClient.connect();

    if (!socket) {
      return;
    }

    const subscribeToActiveFamily = () => {
      socket.emit("family.subscribe", { familyId: activeFamilyId });
    };

    socket.on("connect", subscribeToActiveFamily);
    socket.on("session.ready", subscribeToActiveFamily);
    subscribeToActiveFamily();

    socket.on("message.created", (payload: ChatMessage) => {
      if (payload.familyId !== activeFamilyId) {
        return;
      }

      appendMessage(payload);

      if (
        payload.senderUserId !== currentUserId &&
        scrollRef.current &&
        isNearBottom(scrollRef.current)
      ) {
        void markMessageRead(payload.id);
      }
    });

    socket.on("message.deleted", (payload: DeletedMessagePayload) => {
      if (payload.familyId !== activeFamilyId) {
        return;
      }

      setMessages((current) => current.filter((message) => message.id !== payload.id));
      setReplyToMessage((current) => (current?.id === payload.id ? null : current));
    });

    socket.on("messages.read", (payload: MessageReadPayload) => {
      if (payload.familyId !== activeFamilyId) {
        return;
      }

      if (payload.userId === currentUserId) {
        setViewerLastReadMessageId(payload.messageId);
      }

      setMessages((current) => applyReadReceipt(current, payload));
    });

    return () => {
      socket.off("connect", subscribeToActiveFamily);
      socket.off("session.ready", subscribeToActiveFamily);
      socket.off("message.created");
      socket.off("message.deleted");
      socket.off("messages.read");
    };
  }, [activeFamilyId, currentUserId]);

  useEffect(() => {
    if (!activeFamilyId) {
      return;
    }

    const refresh = () => {
      void refreshMessages()
        .then((payload) => {
          if (payload) {
            markLatestVisibleMessageAsRead(payload.messages);
          }
        })
        .catch(() => {
          // Ignore background refresh errors; realtime may still be active.
        });
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }, 15000);

    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [activeFamilyId, currentUserId]);

  useEffect(() => {
    if (!scrollRef.current || loading || initialScrollAppliedRef.current) {
      return;
    }

    if (!initialScrollTargetMessageIdRef.current) {
      initialScrollAppliedRef.current = true;
      return;
    }

    const targetElement = scrollRef.current.querySelector<HTMLElement>(
      `[data-message-id="${initialScrollTargetMessageIdRef.current}"]`,
    );

    if (!targetElement) {
      return;
    }

    shouldAutoScrollRef.current = false;
    initialScrollAppliedRef.current = true;

    requestAnimationFrame(() => {
      targetElement.scrollIntoView({
        block: "center",
        behavior: "auto",
      });
    });
  }, [groupedMessages, loading]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    if (!shouldAutoScrollRef.current) {
      return;
    }

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: loading ? "auto" : "smooth",
    });
  }, [groupedMessages, loading]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      markLatestVisibleMessageAsRead(messages);
    }
  }, [messages, loading, currentUserId]);

  useEffect(() => {
    if (!lightbox) {
      return;
    }

    function handleLightboxKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setLightbox(null);
      }

      if (event.key === "ArrowLeft") {
        showPreviousPhoto();
      }

      if (event.key === "ArrowRight") {
        showNextPhoto();
      }
    }

    window.addEventListener("keydown", handleLightboxKey);
    return () => window.removeEventListener("keydown", handleLightboxKey);
  }, [lightbox]);

  async function submitMessage() {
    setError(null);
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    const previousText = text;
    const previousReply = replyToMessage;
    const familyKey = familyKeyRef.current;

    if (!familyKey) {
      setError("Нет семейного ключа шифрования. Откройте чат по ссылке или QR-коду из админки.");
      return;
    }

    setText("");
    setReplyToMessage(null);
    setEmojiOpen(false);

    try {
      const encryptedText = await encryptMessageText(trimmedText, familyKey);
      const message = await apiClient.request<ChatMessage>({
        path: "/messages",
        method: "POST",
        body: JSON.stringify({
          text: encryptedText,
          replyToMessageId: previousReply?.id,
        }),
      });

      appendMessage(message);

      await markMessageRead(message.id);
    } catch (reason) {
      setText(previousText);
      setReplyToMessage(previousReply);
      setError(reason instanceof Error ? reason.message : "Не удалось отправить сообщение");
    }
  }

  async function uploadImages(files: File[]) {
    setError(null);

    const familyKey = familyKeyRef.current;

    if (!familyKey) {
      setError("Нет семейного ключа шифрования. Откройте чат по ссылке или QR-коду из админки.");
      return;
    }

    if (files.length === 0) {
      return;
    }

    if (files.length > 10) {
      setError("В один альбом можно добавить до 10 фото.");
      return;
    }

    if (files.some((file) => !file.type.startsWith("image/"))) {
      setError("Можно отправлять только картинки.");
      return;
    }

    if (files.some((file) => file.size > 8 * 1024 * 1024)) {
      setError("Одна из картинок слишком большая. Максимум 8 МБ на фото.");
      return;
    }

    const previousText = text;
    const previousReply = replyToMessage;
    const caption = text.trim();
    setText("");
    setReplyToMessage(null);
    setEmojiOpen(false);
    setImageUploading(true);

    try {
      const encryptedText = await encryptMessageText(caption, familyKey);
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      formData.append("text", encryptedText);
      if (previousReply?.id) {
        formData.append("replyToMessageId", previousReply.id);
      }

      const response = await fetch(`${apiClient.baseUrl}/attachments/images/album`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const message = (await response.json()) as ChatMessage;
      appendMessage(message);
    } catch (reason) {
      setText(previousText);
      setReplyToMessage(previousReply);
      setError(reason instanceof Error ? reason.message : "Не удалось отправить картинку");
    } finally {
      setImageUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void submitMessage();
  }

  function handlePickReply(message: ChatMessage) {
    setReplyToMessage(message);
    textareaRef.current?.focus();
  }

  async function handleDeleteMessage(message: ChatMessage) {
    const confirmed = window.confirm("Удалить это сообщение у всех участников чата?");

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      await apiClient.request<DeletedMessagePayload>({
        path: `/messages/${encodeURIComponent(message.id)}`,
        method: "DELETE",
      });

      setMessages((current) => current.filter((item) => item.id !== message.id));
      setReplyToMessage((current) => (current?.id === message.id ? null : current));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить сообщение");
    }
  }

  function handleAddEmoji(emoji: string) {
    setText((current) => {
      const spacer = current.trim().length === 0 ? "" : " ";
      return `${current}${spacer}${emoji}`.trimStart();
    });
    textareaRef.current?.focus();
  }

  function handlePickImage(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);

    if (files.length === 0) {
      return;
    }

    void uploadImages(files);
  }

  function openLightbox(attachments: ChatAttachment[], index: number) {
    setLightbox({
      attachments,
      index,
    });
  }

  function showPreviousPhoto() {
    setLightbox((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        index: (current.index - 1 + current.attachments.length) % current.attachments.length,
      };
    });
  }

  function showNextPhoto() {
    setLightbox((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        index: (current.index + 1) % current.attachments.length,
      };
    });
  }

  return (
    <section className="chatLayout">
      <div className="chatShell">
        <div className="chatNotices">
          {loading ? <div className="statusMessage">Загружаем семейные сообщения…</div> : null}
          {error ? <div className="statusMessage error">{error}</div> : null}
          {!familyKey ? (
            <div className="statusMessage">
              Сообщения защищены E2E. Чтобы писать и читать новые сообщения, откройте чат по семейной ссылке или QR.
            </div>
          ) : null}
        </div>
        <div
          ref={scrollRef}
          className="chatScroll"
          onScroll={(event) => {
            shouldAutoScrollRef.current = isNearBottom(event.currentTarget);

            if (event.currentTarget.scrollTop < 140 && olderCursor && !loadingOlder) {
              void loadOlderMessages();
            }

            if (shouldAutoScrollRef.current) {
              markLatestVisibleMessageAsRead(messages);
            }
          }}
        >
          <div className="chatThread">
            {olderCursor ? (
              <button
                type="button"
                className="chatLoadMoreButton"
                onClick={() => void loadOlderMessages()}
                disabled={loadingOlder}
              >
                {loadingOlder ? "Загружаем историю…" : "Показать более старые"}
              </button>
            ) : null}
            {groupedMessages.map((group, groupIndex) => (
              <div key={`${group.dayKey}-${group.sender.id}-${groupIndex}`} className="chatDayBlock">
                {groupIndex === 0 || groupedMessages[groupIndex - 1]?.dayKey !== group.dayKey ? (
                  <div className="chatDayDivider">
                    <span>{group.dayLabel}</span>
                  </div>
                ) : null}

                <div className={`chatCluster ${group.isOwn ? "isOwn" : "isOther"}`}>
                  {!group.isOwn ? (
                    <div className={`chatAvatar tone-${group.tone}`}>
                      {getInitials(group.sender.displayName)}
                    </div>
                  ) : null}

                  <div className="chatClusterBody">
                    {group.items.map((message, itemIndex) => {
                      const isFirst = itemIndex === 0;
                      const isLast = itemIndex === group.items.length - 1;
                      const showUnreadDivider = firstUnreadMessageId === message.id;
                      const readByOthers = (message.readByUserIds ?? []).filter(
                        (userId) => userId !== message.senderUserId,
                      );
                      const readReceipt = readByOthers.length > 0 ? "✓✓" : "✓";

                      return (
                        <div
                          key={message.id}
                          className={`chatRow ${group.isOwn ? "isOwn" : "isOther"}`}
                          data-message-id={message.id}
                        >
                          {showUnreadDivider ? (
                            <div className="chatUnreadDivider">
                              <span>Непрочитанные</span>
                            </div>
                          ) : null}
                          <article
                            className={`chatBubble tone-${group.tone} ${isFirst ? "isFirst" : ""} ${isLast ? "isLast hasTail" : ""}`}
                            data-own={group.isOwn}
                            onClick={() => handlePickReply(message)}
                          >
                            {message.replyToMessage ? (
                              <div className="chatReplyBlock">
                                <div className="chatReplyAuthor">
                                  {message.replyToMessage.sender.displayName}
                                </div>
                                <div className="chatReplyText">
                                  {buildReplyPreview(message.replyToMessage)}
                                </div>
                              </div>
                            ) : null}
                            {message.attachments.length > 0 ? (
                              <div
                                className={`chatAttachments album-${Math.min(message.attachments.length, 4)}`}
                                data-count={message.attachments.length}
                              >
                                {message.attachments.map((attachment, attachmentIndex) => (
                                  <button
                                    key={attachment.id}
                                    type="button"
                                    className="chatImageButton"
                                    style={{
                                      aspectRatio: getAttachmentDisplayAspectRatio(
                                        attachment,
                                        message.attachments.length === 1,
                                      ),
                                    }}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openLightbox(message.attachments, attachmentIndex);
                                    }}
                                  >
                                    <img
                                      src={attachment.url}
                                      alt={attachment.originalName}
                                      className="chatImage"
                                      width={attachment.width ?? undefined}
                                      height={attachment.height ?? undefined}
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            <span>{message.text ?? ""}</span>
                            {isLast || canDeleteMessages ? (
                              <div className="chatMetaRow">
                                {isLast ? (
                                  <time className="chatTime" dateTime={message.createdAt}>
                                    {group.isOwn ? `${readReceipt} ${formatTime(message.createdAt)}` : formatTime(message.createdAt)}
                                  </time>
                                ) : null}
                                {canDeleteMessages ? (
                                  <button
                                    type="button"
                                    className="chatDeleteButton"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleDeleteMessage(message);
                                    }}
                                    aria-label="Удалить сообщение"
                                    title="Удалить сообщение"
                                  >
                                    Удалить
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </article>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>
            ))}

            {!loading && groupedMessages.length === 0 ? (
              <div className="chatEmptyState">
                <div className="chatEmptyTitle">Пока здесь тихо</div>
                <div className="chatEmptyText">
                  Напишите первое сообщение, и разговор начнётся прямо здесь.
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="chatComposer">
          <form onSubmit={handleSubmit} className="chatComposerForm">
            {replyToMessage ? (
              <div className="chatComposerReply">
                <div className="chatComposerReplyMeta">
                  <div className="chatComposerReplyAuthor">
                    Ответ: {replyToMessage.sender.displayName}
                  </div>
                  <div className="chatComposerReplyText">
                    {buildReplyPreview(replyToMessage)}
                  </div>
                </div>
                <button
                  type="button"
                  className="chatComposerReplyClose"
                  onClick={() => setReplyToMessage(null)}
                >
                  Отменить
                </button>
              </div>
            ) : null}
            {emojiOpen ? (
              <div className="chatEmojiPanel">
                <div className="chatEmojiRow">
                  {quickEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="chatEmojiButton"
                      onClick={() => handleAddEmoji(emoji)}
                    >
                      {emoji}
                    </button>
            ))}
            {newerCursor ? (
              <button
                type="button"
                className="chatLoadMoreButton isNewer"
                onClick={() => void loadNewerMessages()}
                disabled={loadingNewer}
              >
                {loadingNewer ? "Загружаем новые…" : "Показать более новые"}
              </button>
            ) : null}
          </div>
        </div>
            ) : null}
            <button
              type="button"
              className={`chatEmojiToggle ${emojiOpen ? "isOpen" : ""}`}
              onClick={() => setEmojiOpen((current) => !current)}
              aria-label="Открыть эмодзи"
            >
              🙂
            </button>
            <button
              type="button"
              className="chatAttachButton"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              aria-label="Отправить картинку"
            >
              📷
            </button>
            <input
              ref={fileInputRef}
              className="visuallyHidden"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(event) => handlePickImage(event.target.files)}
            />
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Напишите сообщение…"
            />
            <button type="submit" className="chatSendButton" disabled={!text.trim() || imageUploading}>
              {imageUploading ? "Грузим…" : "Отправить"}
            </button>
          </form>
        </div>
      </div>
      {lightbox ? (
        <div className="chatLightbox" role="dialog" aria-modal="true" aria-label="Просмотр фото">
          <button type="button" className="chatLightboxBackdrop" onClick={() => setLightbox(null)} />
          <div className="chatLightboxFrame">
            <div className="chatLightboxTopbar">
              <span>
                {lightbox.index + 1} из {lightbox.attachments.length}
              </span>
              <button type="button" className="chatLightboxClose" onClick={() => setLightbox(null)}>
                Закрыть
              </button>
            </div>
            {lightbox.attachments.length > 1 ? (
              <button
                type="button"
                className="chatLightboxNav isPrev"
                onClick={showPreviousPhoto}
                aria-label="Предыдущее фото"
              >
                ‹
              </button>
            ) : null}
            <img
              src={lightbox.attachments[lightbox.index]?.url}
              alt={lightbox.attachments[lightbox.index]?.originalName ?? "Фото"}
              className="chatLightboxImage"
              width={lightbox.attachments[lightbox.index]?.width ?? undefined}
              height={lightbox.attachments[lightbox.index]?.height ?? undefined}
            />
            {lightbox.attachments.length > 1 ? (
              <button
                type="button"
                className="chatLightboxNav isNext"
                onClick={showNextPhoto}
                aria-label="Следующее фото"
              >
                ›
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
