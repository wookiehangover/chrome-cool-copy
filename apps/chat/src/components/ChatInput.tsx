import { useCallback } from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { ModelPicker } from "@/components/ai-elements/model-picker";
import { PageContextBadge } from "./PageContextBadge";
import { useChatContext } from "@/contexts/ChatContext";

export function ChatInput() {
  const {
    input,
    setInput,
    sendMessage,
    pageContext,
    clearContext,
    contextError,
    isLoading,
    isLoadingContext,
    status,
    selectedModel,
    setSelectedModel,
  } = useChatContext();

  const handleSubmit = useCallback(
    ({ text }: { text: string }) => {
      if (!text.trim()) return;
      setInput("");
      sendMessage({ parts: [{ type: "text", text }] });
    },
    [sendMessage, setInput],
  );

  const placeholder = pageContext ? "Ask about this page..." : "Ask a question...";
  const isSubmitDisabled = isLoading || !input.trim() || isLoadingContext;

  return (
    <div className="border-t border-border p-4">
      {pageContext && <PageContextBadge context={pageContext} onClear={clearContext} />}
      {!pageContext && contextError && (
        <p className="mb-2 text-xs text-muted-foreground" role="status">
          {contextError}
        </p>
      )}
      <PromptInput onSubmit={handleSubmit} className="rounded-lg border border-input bg-background">
        <PromptInputTextarea
          placeholder={placeholder}
          disabled={isLoading || isLoadingContext}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <PromptInputFooter>
          <ModelPicker
            value={selectedModel}
            onValueChange={setSelectedModel}
            disabled={isLoading}
          />
          <PromptInputSubmit status={status} disabled={isSubmitDisabled} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
