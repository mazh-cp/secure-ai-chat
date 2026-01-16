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
    <div className="mt-4">
      {/* Clear white border frame around chat input area */}
      <div 
        className="rounded-2xl p-5 border-2 transition-all"
        style={{
          borderColor: 'rgba(255, 255, 255, 0.5)',
          background: 'rgba(var(--surface-1), 0.75)',
          backdropFilter: 'blur(12px)',
          boxShadow: `
            0 4px 12px rgba(0, 0, 0, 0.15),
            0 0 0 1px rgba(255, 255, 255, 0.4) inset,
            0 1px 0 rgba(255, 255, 255, 0.3) inset
          `,
        }}
      >
        <form onSubmit={handleSubmit}>
          <div className="flex space-x-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={disabled ? "Configure API key in Settings to start chatting..." : "Type your message securely..."}
              className="flex-1 glass-input text-theme text-base placeholder-theme-subtle rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-berry/30 disabled:opacity-50 transition-all"
              style={{
                background: "rgba(var(--surface-1), 0.8)",
                borderColor: "rgba(255, 255, 255, 0.2)",
                color: "rgb(var(--text-1))",
                borderWidth: '1px',
              }}
              disabled={isDisabled}
            />
            <button
              type="submit"
              disabled={!input.trim() || isDisabled}
              className="glass-button text-theme text-base px-6 py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none transition-all"
              style={{
                background: "rgb(var(--accent))",
                color: "white",
                borderColor: "rgba(255, 255, 255, 0.2)",
              }}
            >
              Send
            </button>
          </div>
          <p className="text-sm text-theme-muted mt-3 text-center" style={{ opacity: 0.8 }}>
            🔒 Messages are processed securely
          </p>
        </form>
      </div>
    </div>
  )
}
