import { useState } from "react";
import { XIcon } from "lucide-react";
import type { UIMessage } from "ai";
import { useNavigationContext } from "@/contexts/NavigationContext";
import { useBoostAuthoring } from "@/hooks/useBoostAuthoring";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { MessageList } from "@/components/MessageList";
import { BoostCodePreview } from "@/components/BoostCodePreview";
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
  const { params, goBack } = useNavigationContext();
  const domain = params?.domain || "*";
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const { messages, sendMessage, currentCode, isLoading, error, clearMessages, saveBoost } =
    useBoostAuthoring({ domain });

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Create Boost</h1>
            <p className="text-xs text-muted-foreground">Domain: {domain}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={goBack}>
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Code Preview */}
      <BoostCodePreview code={currentCode} />

      {/* Conversation */}
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start Creating Your Boost"
              description="Describe what you want your boost to do, and I'll help you write the code."
            />
          ) : (
            <MessageList messages={messages} getMessageContent={getMessageContent} />
          )}
        </ConversationContent>
      </Conversation>

      {/* Error Display */}
      {error && (
        <div className="border-t border-destructive bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{error.message}</p>
        </div>
      )}

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

