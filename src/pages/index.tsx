import type { FormEvent, ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import type { Conversation } from '../types/conversation'
import type { Message } from '../types/message'
import type { User } from '../types/user'
import { getLoggedUserId } from '../utils/getLoggedUserId'
import {
  createConversation,
  getConversations,
  getMessages,
  getUsers,
  sendMessage,
} from '../utils/messagingApi'
import {
  formatTimestamp,
  getConversationParticipant,
  sortConversations,
  sortMessages,
} from '../utils/messagingView'
import styles from '../styles/Home.module.css'

const MAX_MESSAGE_LENGTH = 1000
const REFRESH_INTERVAL_MS = 15000
const loggedUserId = getLoggedUserId()

type LoadState = 'idle' | 'loading' | 'success' | 'error'
type LoadOptions = {
  silent?: boolean
}

const Home = (): ReactElement => {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationState, setConversationState] = useState<LoadState>('idle')
  const [messageState, setMessageState] = useState<LoadState>('idle')
  const [userState, setUserState] = useState<LoadState>('idle')
  const [newConversationRecipientId, setNewConversationRecipientId] =
    useState('')
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [createConversationError, setCreateConversationError] = useState<
    string | null
  >(null)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isThreadVisibleOnMobile, setIsThreadVisibleOnMobile] = useState(false)

  const orderedConversations = useMemo(
    () => sortConversations(conversations),
    [conversations]
  )
  const selectedConversation = useMemo(
    () =>
      orderedConversations.find(
        (conversation) => conversation.id === selectedConversationId
      ) ?? null,
    [orderedConversations, selectedConversationId]
  )
  const orderedMessages = useMemo(() => sortMessages(messages), [messages])
  const availableRecipients = useMemo(
    () => users.filter((user) => user.id !== loggedUserId),
    [users]
  )
  const loggedUser = users.find((user) => user.id === loggedUserId) ?? {
    id: loggedUserId,
    nickname: 'Thibaut',
    token: '',
  }
  const trimmedDraft = draft.trim()
  const isDraftTooLong = draft.length > MAX_MESSAGE_LENGTH
  const canSend =
    trimmedDraft.length > 0 &&
    !isDraftTooLong &&
    !isSending &&
    selectedConversation !== null &&
    messageState === 'success'

  const loadConversations = useCallback(async (options?: LoadOptions) => {
    if (!options?.silent) {
      setConversationState('loading')
    }

    try {
      const result = sortConversations(await getConversations(loggedUserId))

      setConversations(result)
      setConversationState('success')
      setSelectedConversationId((currentId) => {
        if (
          currentId !== null &&
          result.some((conversation) => conversation.id === currentId)
        ) {
          return currentId
        }

        return result[0]?.id ?? null
      })
    } catch {
      setConversationState('error')
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setUserState('loading')

    try {
      const result = await getUsers()

      setUsers(result)
      setUserState('success')
      setNewConversationRecipientId((currentRecipientId) => {
        if (
          currentRecipientId !== '' &&
          result.some((user) => String(user.id) === currentRecipientId)
        ) {
          return currentRecipientId
        }

        return (
          result.find((user) => user.id !== loggedUserId)?.id.toString() ?? ''
        )
      })
    } catch {
      setUserState('error')
    }
  }, [])

  const loadMessages = useCallback(
    async (conversationId: number, options?: LoadOptions) => {
      if (!options?.silent) {
        setMessageState('loading')
      }
      setSendError(null)

      try {
        setMessages(sortMessages(await getMessages(conversationId)))
        setMessageState('success')
      } catch {
        if (!options?.silent) {
          setMessages([])
        }
        setMessageState('error')
      }
    },
    []
  )

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadConversations({ silent: true })
    }, REFRESH_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [loadConversations])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (selectedConversationId === null) {
      setMessages([])
      setMessageState('idle')
      return
    }

    void loadMessages(selectedConversationId)
  }, [loadMessages, selectedConversationId])

  useEffect(() => {
    if (selectedConversationId === null) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      void loadMessages(selectedConversationId, { silent: true })
    }, REFRESH_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [loadMessages, selectedConversationId])

  const handleSelectConversation = (conversationId: number): void => {
    setSelectedConversationId(conversationId)
    setIsThreadVisibleOnMobile(true)
  }

  const handleCreateConversation = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()

    const recipientId = Number(newConversationRecipientId)
    const recipient = users.find((user) => user.id === recipientId)

    if (recipient === undefined || isCreatingConversation) {
      return
    }

    const lastMessageTimestamp = Math.floor(Date.now() / 1000)
    const nextConversation = {
      recipientId: recipient.id,
      recipientNickname: recipient.nickname,
      senderId: loggedUser.id,
      senderNickname: loggedUser.nickname,
      lastMessageTimestamp,
    }

    setIsCreatingConversation(true)
    setCreateConversationError(null)

    try {
      const createdConversation = await createConversation(
        loggedUserId,
        nextConversation
      )
      const conversation = {
        id: createdConversation.id,
        ...nextConversation,
      }

      setConversations((currentConversations) =>
        sortConversations([conversation, ...currentConversations])
      )
      setSelectedConversationId(createdConversation.id)
      setMessages([])
      setMessageState('success')
      setDraft('')
      setIsThreadVisibleOnMobile(true)
    } catch {
      setCreateConversationError(
        'La conversation n’a pas pu etre creee. Vous pouvez reessayer.'
      )
    } finally {
      setIsCreatingConversation(false)
    }
  }

  const handleSendMessage = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()

    if (!canSend || selectedConversation === null) {
      return
    }

    const body = trimmedDraft
    const timestamp = Math.floor(Date.now() / 1000)

    setIsSending(true)
    setSendError(null)

    try {
      const createdMessage = await sendMessage(
        selectedConversation.id,
        body,
        timestamp
      )
      const nextMessage: Message = {
        id: createdMessage.id,
        conversationId: selectedConversation.id,
        authorId: loggedUserId,
        timestamp,
        body,
      }

      setMessages((currentMessages) =>
        sortMessages([...currentMessages, nextMessage])
      )
      setConversations((currentConversations) =>
        currentConversations.map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, lastMessageTimestamp: timestamp }
            : conversation
        )
      )
      setDraft('')
    } catch {
      setSendError(
        'Votre message n’a pas pu etre envoye. Vous pouvez reessayer.'
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Messages - leboncoin</title>
        <meta
          name="description"
          content="Consultez et envoyez vos messages leboncoin."
        />
      </Head>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>leboncoin</p>
          <h1 className={styles.title}>Messages</h1>
        </div>
        <div className={styles.currentUser} aria-label="Utilisateur connecte">
          Thibaut
        </div>
      </header>

      <main className={styles.shell}>
        <section
          className={`${styles.sidebar} ${isThreadVisibleOnMobile ? styles.sidebarHiddenMobile : ''}`}
          aria-labelledby="conversation-list-title"
        >
          <div className={styles.panelHeader}>
            <h2 id="conversation-list-title">Conversations</h2>
          </div>

          <form
            className={styles.newConversation}
            onSubmit={handleCreateConversation}
          >
            <label
              className={styles.newConversationLabel}
              htmlFor="new-conversation-recipient"
            >
              Nouvelle conversation
            </label>
            <div className={styles.newConversationControls}>
              <select
                className={styles.select}
                disabled={
                  userState === 'loading' ||
                  isCreatingConversation ||
                  availableRecipients.length === 0
                }
                id="new-conversation-recipient"
                onChange={(event) =>
                  setNewConversationRecipientId(event.target.value)
                }
                value={newConversationRecipientId}
              >
                {availableRecipients.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nickname}
                  </option>
                ))}
              </select>
              <button
                className={styles.secondaryButton}
                disabled={
                  userState !== 'success' ||
                  availableRecipients.length === 0 ||
                  isCreatingConversation
                }
                type="submit"
              >
                {isCreatingConversation ? 'Creation...' : 'Creer'}
              </button>
            </div>
            {userState === 'loading' && (
              <p className={styles.formHint} role="status">
                Chargement des contacts...
              </p>
            )}
            {userState === 'error' && (
              <p className={styles.formError} role="alert">
                Impossible de charger les contacts.
                <button
                  className={styles.inlineButton}
                  type="button"
                  onClick={loadUsers}
                >
                  Reessayer
                </button>
              </p>
            )}
            {userState === 'success' && availableRecipients.length === 0 && (
              <p className={styles.formHint}>Aucun contact disponible.</p>
            )}
            {createConversationError !== null && (
              <p className={styles.formError} role="alert">
                {createConversationError}
              </p>
            )}
          </form>

          {conversationState === 'loading' && (
            <div className={styles.status} role="status">
              Chargement des conversations...
            </div>
          )}

          {conversationState === 'error' && (
            <div className={styles.errorBox} role="alert">
              Impossible de charger les conversations.
              <button
                className={styles.inlineButton}
                type="button"
                onClick={() => loadConversations()}
              >
                Reessayer
              </button>
            </div>
          )}

          {conversationState === 'success' &&
            orderedConversations.length === 0 && (
              <div className={styles.emptyState}>
                Aucune conversation pour le moment.
              </div>
            )}

          {orderedConversations.length > 0 && (
            <ul
              className={styles.conversationList}
              aria-label="Liste des conversations"
            >
              {orderedConversations.map((conversation) => {
                const participant = getConversationParticipant(
                  conversation,
                  loggedUserId
                )
                const isSelected = conversation.id === selectedConversationId

                return (
                  <li key={conversation.id}>
                    <button
                      className={`${styles.conversationButton} ${isSelected ? styles.selectedConversation : ''}`}
                      type="button"
                      aria-current={isSelected ? 'true' : undefined}
                      onClick={() => handleSelectConversation(conversation.id)}
                    >
                      <span className={styles.avatar} aria-hidden="true">
                        {participant.nickname.charAt(0).toUpperCase()}
                      </span>
                      <span className={styles.conversationMeta}>
                        <span className={styles.conversationName}>
                          {participant.nickname}
                        </span>
                        <span className={styles.conversationDate}>
                          {formatTimestamp(conversation.lastMessageTimestamp)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section
          className={`${styles.thread} ${isThreadVisibleOnMobile ? styles.threadVisibleMobile : ''}`}
          aria-labelledby="thread-title"
        >
          {selectedConversation === null ? (
            <div className={styles.emptyThread}>
              Selectionnez une conversation pour consulter les messages.
            </div>
          ) : (
            <>
              <div className={styles.threadHeader}>
                <button
                  className={styles.backButton}
                  type="button"
                  onClick={() => setIsThreadVisibleOnMobile(false)}
                >
                  Retour
                </button>
                <div>
                  <p className={styles.threadLabel}>Conversation avec</p>
                  <h2 id="thread-title">
                    {
                      getConversationParticipant(
                        selectedConversation,
                        loggedUserId
                      ).nickname
                    }
                  </h2>
                </div>
              </div>

              <div className={styles.messageList} aria-live="polite">
                {messageState === 'loading' && (
                  <div className={styles.status} role="status">
                    Chargement des messages...
                  </div>
                )}

                {messageState === 'error' && (
                  <div className={styles.errorBox} role="alert">
                    Impossible de charger les messages.
                    <button
                      className={styles.inlineButton}
                      type="button"
                      onClick={() => loadMessages(selectedConversation.id)}
                    >
                      Reessayer
                    </button>
                  </div>
                )}

                {messageState === 'success' && orderedMessages.length === 0 && (
                  <div className={styles.emptyState}>
                    Aucun message dans cette conversation.
                  </div>
                )}

                {orderedMessages.map((message) => {
                  const isOwnMessage = message.authorId === loggedUserId

                  return (
                    <article
                      className={`${styles.messageRow} ${isOwnMessage ? styles.ownMessageRow : ''}`}
                      key={message.id}
                    >
                      <div
                        className={`${styles.messageBubble} ${isOwnMessage ? styles.ownMessage : ''}`}
                      >
                        <p>{message.body}</p>
                        <time
                          dateTime={new Date(
                            message.timestamp * 1000
                          ).toISOString()}
                        >
                          {formatTimestamp(message.timestamp)}
                        </time>
                      </div>
                    </article>
                  )
                })}
              </div>

              <form className={styles.composer} onSubmit={handleSendMessage}>
                <label className={styles.composerLabel} htmlFor="message-body">
                  Nouveau message
                </label>
                <textarea
                  id="message-body"
                  aria-describedby="message-help"
                  className={styles.textarea}
                  maxLength={MAX_MESSAGE_LENGTH + 1}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ecrivez votre message"
                  value={draft}
                  disabled={isSending || messageState === 'loading'}
                />
                <div className={styles.composerFooter}>
                  <p
                    className={`${styles.helpText} ${isDraftTooLong ? styles.helpTextError : ''}`}
                    id="message-help"
                  >
                    {draft.length}/{MAX_MESSAGE_LENGTH}
                  </p>
                  <button
                    className={styles.primaryButton}
                    type="submit"
                    disabled={!canSend}
                  >
                    {isSending ? 'Envoi...' : 'Envoyer'}
                  </button>
                </div>
                {sendError !== null && (
                  <p className={styles.sendError} role="alert">
                    {sendError}
                  </p>
                )}
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  )
}

export default Home
