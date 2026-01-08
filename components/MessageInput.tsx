'use client'

import { useState, FormEvent } from 'react'

interface MessageInputProps {
  onSendMessage: (content: string) => void
  isLoading: boolean
  disabled?: boolean
}

export default function MessageInput({ onSendMessage, isLoading, disabled }: MessageInputProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isLoading && !disabled) {
      onSendMessage(input)
      setInput('')
    }
  }

  const isDisabled = isLoading || disabled

  return (
    <form onSubmit={handleSubmit} className="border-t border-brand-berry/20 p-4">
      <div className="flex space-x-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={disabled ? "Configure API key in Settings to start chatting..." : "Type your message securely..."}
          className="flex-1 glass-input text-theme placeholder-theme-subtle rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-berry/30 disabled:opacity-50 transition-all"
          disabled={isDisabled}
        />
        <button
          type="submit"
          disabled={!input.trim() || isDisabled}
          className="glass-button text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none border-brand-berry/30"
        >
          Send
        </button>
      </div>
      <p className="text-xs text-brand-berry/80 mt-2">
        🔒 Messages are processed securely
      </p>
    </form>
  )
}
