'use client'

import { useState } from 'react'

export default function MCPToolsSetup() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="glass-card rounded-xl p-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h2 className="text-lg font-semibold text-theme">🔧 Advanced: MCP Tools Setup</h2>
          <p className="text-sm text-theme-muted mt-1">
            For advanced functionality, you can add MCP (Model Context Protocol) tools using ToolHive.
          </p>
        </div>
        <span className="text-theme-subtle text-xl ml-4 flex-shrink-0">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-white/10 space-y-6">
          {/* ToolHive Installation */}
          <div>
            <h3 className="text-sm font-semibold text-theme mb-2">ToolHive Installation</h3>
            <a
              href="https://toolhive.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-berry hover:text-brand-berry/80 underline text-sm transition-colors"
            >
              ToolHive Installation Guide
            </a>
          </div>

          {/* Add Fetch MCP Server */}
          <div>
            <h3 className="text-sm font-semibold text-theme mb-3">Add Fetch MCP Server</h3>
            <ul className="space-y-2 text-sm text-theme-muted list-disc list-inside">
              <li>Open ToolHive and go to the Registry tab</li>
              <li>Search for &quot;Fetch&quot; in the default registry</li>
              <li>Add it to your local servers</li>
              <li>Go to MCP Servers tab and copy the endpoint URL</li>
              <li>In this demo&apos;s Tools tab, add a new tool with that endpoint</li>
              <li>Click Test Tool to verify it shows available tools</li>
            </ul>
            <div className="mt-3 p-3 glass rounded-lg border-white/10">
              <p className="text-xs text-theme-subtle mb-1">Example prompt:</p>
              <code className="text-xs font-mono text-theme block break-all">
                Tell me more about https://checkpoint.com
              </code>
            </div>
            <p className="text-xs text-theme-subtle mt-2">
              If it works, save that prompt for the demo.
            </p>
          </div>

          {/* Add Filesystem MCP Server */}
          <div>
            <h3 className="text-sm font-semibold text-theme mb-3">Add Filesystem MCP Server</h3>
            <ul className="space-y-2 text-sm text-theme-muted list-disc list-inside">
              <li>Add "Filesystem" from the default registry in ToolHive</li>
              <li>Configure:
                <ul className="ml-6 mt-1 space-y-1 list-disc">
                  <li>Host path: Full path to your documents folder (e.g., "/Users/steve/Documents/mcpdemodocs")</li>
                  <li>Container path: "/projects"</li>
                </ul>
              </li>
              <li>Add the endpoint URL as a new tool in this demo</li>
              <li>Create a file like "hello.txt" in your documents folder</li>
            </ul>
            <div className="mt-3 p-3 glass rounded-lg border-white/10">
              <p className="text-xs text-theme-subtle mb-1">Example prompt:</p>
              <code className="text-xs font-mono text-theme block break-all">
                What is in the file in the /projects directory hello.txt
              </code>
            </div>
          </div>

          {/* Pro Tip */}
          <div className="p-4 glass-card border-brand-berry/30 rounded-xl">
            <p className="text-sm text-theme">
              <strong className="text-brand-berry">💡 Pro Tip:</strong>{' '}
              Add a malicious system prompt to the bottom of your test file to see Lakera Guard detect and block it!
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
