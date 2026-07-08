import { fireEvent, render, screen } from '@testing-library/react'
import App from '../pages'

const conversations = [
  {
    id: 1,
    recipientId: 2,
    recipientNickname: 'Jeremie',
    senderId: 1,
    senderNickname: 'Thibaut',
    lastMessageTimestamp: 1625637849,
  },
  {
    id: 3,
    recipientId: 1,
    recipientNickname: 'Thibaut',
    senderId: 4,
    senderNickname: 'Elodie',
    lastMessageTimestamp: 1625648667,
  },
]

const conversationOneMessages = [
  {
    id: 1,
    conversationId: 1,
    timestamp: 1625637849,
    authorId: 1,
    body: 'Bonjour Jeremie',
  },
]

const conversationThreeMessages = [
  {
    id: 3,
    conversationId: 3,
    timestamp: 1625648667,
    authorId: 4,
    body: 'Bonjour Thibaut',
  },
]

const mockJson = (data: unknown, ok = true): Promise<Response> => {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 503,
    json: () => Promise.resolve(data),
  } as Response)
}

const setupFetchMock = (): jest.Mock => {
  const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)

    if (url.endsWith('/conversations/1')) {
      return mockJson(conversations)
    }

    if (url.endsWith('/messages/3') && init?.method !== 'POST') {
      return mockJson(conversationThreeMessages)
    }

    if (url.endsWith('/messages/1') && init?.method !== 'POST') {
      return mockJson(conversationOneMessages)
    }

    if (url.endsWith('/messages/3') && init?.method === 'POST') {
      return mockJson({ id: 42 })
    }

    return mockJson(null, false)
  })

  global.fetch = fetchMock
  return fetchMock
}

describe('App', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('loads and renders the conversation list with the newest conversation selected', async () => {
    setupFetchMock()

    render(<App />)

    expect(screen.getByRole('status', { name: '' })).toHaveTextContent(
      'Chargement des conversations'
    )
    expect(
      await screen.findByRole('button', { name: /Elodie/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Jeremie/i })).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Elodie' })
    ).toBeInTheDocument()
    expect(screen.getByText('Bonjour Thibaut')).toBeInTheDocument()
  })

  it('loads messages when a conversation is selected', async () => {
    setupFetchMock()

    render(<App />)

    const jeremieConversation = await screen.findByRole('button', {
      name: /Jeremie/i,
    })
    fireEvent.click(jeremieConversation)

    expect(
      await screen.findByRole('heading', { name: 'Jeremie' })
    ).toBeInTheDocument()
    expect(await screen.findByText('Bonjour Jeremie')).toBeInTheDocument()
  })

  it('sends a valid message after the API confirms creation', async () => {
    const fetchMock = setupFetchMock()

    render(<App />)

    const input = await screen.findByLabelText('Nouveau message')
    fireEvent.change(input, {
      target: { value: '  Est-ce toujours disponible ?  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))

    expect(
      await screen.findByText('Est-ce toujours disponible ?')
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3005/messages/3',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Est-ce toujours disponible ?'),
      })
    )
  })

  it('does not send an empty message', async () => {
    const fetchMock = setupFetchMock()

    render(<App />)

    const input = await screen.findByLabelText('Nouveau message')
    fireEvent.change(input, { target: { value: '    ' } })

    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/messages/3'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('shows a retryable error when conversations cannot load', async () => {
    global.fetch = jest.fn(() => mockJson(null, false))

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger les conversations'
    )
    expect(
      screen.getByRole('button', { name: 'Reessayer' })
    ).toBeInTheDocument()
  })

  it('keeps the draft when sending fails', async () => {
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/conversations/1')) {
        return mockJson(conversations)
      }

      if (url.endsWith('/messages/3') && init?.method !== 'POST') {
        return mockJson(conversationThreeMessages)
      }

      return mockJson(null, false)
    })

    render(<App />)

    const input = await screen.findByLabelText('Nouveau message')
    fireEvent.change(input, { target: { value: 'Message a conserver' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Votre message')
    expect(screen.getByDisplayValue('Message a conserver')).toBeInTheDocument()
  })
})
