"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { websocketClient } from "@/lib/websocket";

type ChatMessage = {
  id: string;
  text: string | null;
  createdAt: string;
  replyToMessage?: {
    id: string;
    text: string | null;
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

type MePayload = {
  user: {
    id: string;
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

function isNearBottom(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 72;
}

function buildReplyPreview(message: {
  text: string | null;
}) {
  const preview = (message.text ?? "").trim();

  if (!preview) {
    return "Сообщение без текста";
  }

  return preview.length > 90 ? `${preview.slice(0, 90)}…` : preview;
}

export function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

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

  function appendMessage(message: ChatMessage) {
    if (scrollRef.current) {
      shouldAutoScrollRef.current = isNearBottom(scrollRef.current);
    }

    setMessages((current) => mergeMessage(current, message));
  }

  useEffect(() => {
    void apiClient
      .request<MePayload>({ path: "/auth/me" })
      .then((payload) => setCurrentUserId(payload.user.id))
      .catch(() => setCurrentUserId(null));

    void apiClient
      .request<ChatMessage[]>({ path: "/messages" })
      .then(setMessages)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить сообщения"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const socket = websocketClient.connect();

    if (!socket) {
      return;
    }

    socket.on("message.created", (payload: ChatMessage) => {
      appendMessage(payload);
    });

    return () => {
      socket.close();
    };
  }, []);

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

  async function submitMessage() {
    setError(null);
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    const previousText = text;
    const previousReply = replyToMessage;
    setText("");
    setReplyToMessage(null);
    setEmojiOpen(false);

    try {
      const message = await apiClient.request<ChatMessage>({
        path: "/messages",
        method: "POST",
        body: JSON.stringify({
          text: trimmedText,
          replyToMessageId: previousReply?.id,
        }),
      });

      appendMessage(message);

      await apiClient.request({
        path: "/reads",
        method: "POST",
        body: JSON.stringify({ messageId: message.id }),
      });
    } catch (reason) {
      setText(previousText);
      setReplyToMessage(previousReply);
      setError(reason instanceof Error ? reason.message : "Не удалось отправить сообщение");
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

  function handleAddEmoji(emoji: string) {
    setText((current) => {
      const spacer = current.trim().length === 0 ? "" : " ";
      return `${current}${spacer}${emoji}`.trimStart();
    });
    textareaRef.current?.focus();
  }

  return (
    <section className="chatLayout">
      <div className="chatShell">
        {loading ? <div className="statusMessage">Загружаем семейные сообщения…</div> : null}
        {error ? <div className="statusMessage error">{error}</div> : null}
        <div
          ref={scrollRef}
          className="chatScroll"
          onScroll={(event) => {
            shouldAutoScrollRef.current = isNearBottom(event.currentTarget);
          }}
        >
          <div className="chatThread">
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

                      return (
                        <div
                          key={message.id}
                          className={`chatRow ${group.isOwn ? "isOwn" : "isOther"}`}
                        >
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
                            <span>{message.text ?? ""}</span>
                            <time className="chatTime" dateTime={message.createdAt}>
                              {formatTime(message.createdAt)}
                            </time>
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
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Напишите сообщение или нажмите на пузырёк, чтобы ответить…"
            />
            <button type="submit" className="chatSendButton" disabled={!text.trim()}>
              Отправить
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
