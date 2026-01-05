import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from '@/components/ai-elements/reasoning'
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import { getToolName, type DynamicToolUIPart, type ToolUIPart, type UITools, type UIMessage } from 'ai'
import { useChatContext } from '@/contexts/ChatContext'

// Helper type for tool parts (either typed or dynamic)
type AnyToolUIPart = DynamicToolUIPart | ToolUIPart<UITools>

interface MessageListProps {
  /** Optional messages array - falls back to ChatContext if not provided */
  messages?: UIMessage[]
  /** Optional getMessageContent function - falls back to ChatContext if not provided */
  getMessageContent?: (message: UIMessage) => string
}

export function MessageList(props: MessageListProps) {
  const context = useChatContext()

  // Use props if provided, otherwise fall back to context
  const messages = props.messages ?? context.messages
  const getMessageContent = props.getMessageContent ?? context.getMessageContent
  const { reasoning, isReasoningStreaming, error } = context
  return (
    <>
      {messages.map((message, index) => {
        const isLastAssistantMessage =
          message.role === 'assistant' && index === messages.length - 1

        // Show reasoning for the last assistant message if we have reasoning content
        const showReasoning =
          isLastAssistantMessage && (reasoning || isReasoningStreaming)

        // Extract tool parts from the message
        const toolParts = message.parts
          .filter((part) => part.type.startsWith('tool-') || part.type === 'dynamic-tool')
          .map((part) => part as unknown as AnyToolUIPart)

        return (
          <Message key={message.id} from={message.role}>
            <MessageContent>
              {message.role === 'assistant' ? (
                <>
                  {showReasoning && (
                    <Reasoning isStreaming={isReasoningStreaming}>
                      <ReasoningTrigger />
                      <ReasoningContent>{reasoning}</ReasoningContent>
                    </Reasoning>
                  )}
                  {toolParts.map((toolPart) => {
                    const toolName = getToolName(toolPart)
                    return (
                      <Tool key={toolPart.toolCallId} className="group">
                        <ToolHeader
                          title={toolName}
                          type={toolPart.type as `tool-${string}`}
                          state={toolPart.state}
                        />
                        <ToolContent>
                          {toolPart.input !== undefined && <ToolInput input={toolPart.input} />}
                          {(toolPart.output !== undefined || toolPart.errorText) && (
                            <ToolOutput output={toolPart.output} errorText={toolPart.errorText} />
                          )}
                        </ToolContent>
                      </Tool>
                    )
                  })}
                  <MessageResponse>{getMessageContent(message)}</MessageResponse>
                </>
              ) : (
                <p className="whitespace-pre-wrap">{getMessageContent(message)}</p>
              )}
            </MessageContent>
          </Message>
        )
      })}

      {/* Show reasoning while streaming before any text response */}
      {isReasoningStreaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
        <Message from="assistant">
          <MessageContent>
            <Reasoning isStreaming={isReasoningStreaming}>
              <ReasoningTrigger />
              <ReasoningContent>{reasoning}</ReasoningContent>
            </Reasoning>
          </MessageContent>
        </Message>
      )}

      {error && (
        <div className="border-l-2 border-destructive pl-3 text-sm">
          <p className="text-destructive">{error.message}</p>
        </div>
      )}
    </>
  )
}

