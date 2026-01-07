import { useState } from "react";
import type { UIMessage } from "ai";
import { CodeIcon, MessageSquareIcon } from "lucide-react";
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
import { BoostCodeEditor } from "@/components/BoostCodeEditor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewMode = "chat" | "code";

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
  const boostId = params?.boostId;
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  // Default to "code" view when editing an existing boost
  const [viewMode, setViewMode] = useState<ViewMode>(boostId ? "code" : "chat");

  const {
    messages,
    sendMessage,
    currentCode,
    setCurrentCode,
    isLoading,
    error,
    saveBoost,
    reasoning,
    isReasoningStreaming,
    isEditMode,
    existingBoost,
  } = useBoostAuthoring({ domain, boostId });

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground overflow-hidden">
      {/* View Toggle */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          {isEditMode && existingBoost && (
            <span className="text-sm text-muted-foreground">
              Editing: <span className="font-medium text-foreground">{existingBoost.name}</span>
            </span>
          )}
        </div>
        <div className="flex rounded-lg border border-border bg-muted p-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("chat")}
            className={cn(
              "gap-1.5 rounded-md px-3 py-1 text-xs",
              viewMode === "chat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquareIcon className="h-3.5 w-3.5" />
            Chat
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("code")}
            className={cn(
              "gap-1.5 rounded-md px-3 py-1 text-xs",
              viewMode === "code"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CodeIcon className="h-3.5 w-3.5" />
            Code
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "chat" ? (
        <>
          {/* Conversation */}
          <Conversation className="flex-1 min-h-0">
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
        </>
      ) : (
        <>
          {/* Code Editor */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <BoostCodeEditor
              code={currentCode}
              onChange={setCurrentCode}
              className="h-full"
            />
          </div>

          {/* Save Button for Code View */}
          <div className="border-t border-border p-4">
            <Button
              onClick={() => setShowSaveDialog(true)}
              disabled={!currentCode || isLoading}
              className="w-full"
            >
              {isEditMode ? "Save Changes" : "Save Boost"}
            </Button>
          </div>
        </>
      )}

      {/* Save Dialog */}
      <BoostSaveDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={saveBoost}
        defaultDomain={domain}
        defaultName={existingBoost?.name}
        defaultDescription={existingBoost?.description}
        defaultRunMode={existingBoost?.runMode}
        isLoading={isLoading}
        isEditMode={isEditMode}
      />
    </div>
  );
}

