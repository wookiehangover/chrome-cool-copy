import { useState } from "react";
import type { UIMessage } from "ai";
import { useNavigationContext } from "@/contexts/NavigationContext";
import { useBoostAuthoring } from "@/hooks/useBoostAuthoring";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { MessageList } from "@/components/MessageList";
import { BoostSaveDialog } from "@/components/BoostSaveDialog";
import { BoostAuthoringInput } from "@/components/BoostAuthoringInput";

// Helper to extract text content from message parts
function getMessageContent(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function BoostAuthoring() {
  const { params } = useNavigationContext();
  const domain = params?.domain || "*";
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const {
    messages,
    sendMessage,
    currentCode,
    isLoading,
    error,
    clearMessages,
    saveBoost,
    reasoning,
    isReasoningStreaming,
  } = useBoostAuthoring({ domain });

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      {/* Conversation */}
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start Creating Your Boost"
              description="Describe what you want your boost to do, and I'll help you write the code."
            />
          ) : (
            <MessageList
              messages={messages}
              getMessageContent={getMessageContent}
              error={error}
              reasoning={reasoning}
              isReasoningStreaming={isReasoningStreaming}
            />
          )}
        </ConversationContent>
      </Conversation>

      {/* Input and Actions */}
      <div className="border-t border-border p-4">
        <BoostAuthoringInput
          onSendMessage={sendMessage}
          onSave={() => setShowSaveDialog(true)}
          isLoading={isLoading}
          hasCode={!!currentCode}
        />
      </div>

      {/* Save Dialog */}
      <BoostSaveDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={saveBoost}
        defaultDomain={domain}
        isLoading={isLoading}
      />
    </div>
  );
}

