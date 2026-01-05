import { useCallback, useState } from "react";
import { SaveIcon } from "lucide-react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";

interface BoostAuthoringInputProps {
  onSendMessage: (content: string) => void;
  onSave: () => void;
  isLoading: boolean;
  hasCode: boolean;
}

export function BoostAuthoringInput({
  onSendMessage,
  onSave,
  isLoading,
  hasCode,
}: BoostAuthoringInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = useCallback(
    ({ text }: { text: string }) => {
      if (!text.trim()) return;
      setInput("");
      onSendMessage(text);
    },
    [onSendMessage]
  );

  const isSubmitDisabled = isLoading || !input.trim();

  return (
    <div className="space-y-3">
      <PromptInput
        onSubmit={handleSubmit}
        className="rounded-lg border border-input bg-background"
      >
        <PromptInputTextarea
          placeholder="Describe what you want your boost to do..."
          disabled={isLoading}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <PromptInputFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={!hasCode || isLoading}
            className="gap-2"
          >
            <SaveIcon className="h-4 w-4" />
            Save
          </Button>
          <PromptInputSubmit status={isLoading ? "streaming" : "ready"} disabled={isSubmitDisabled} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

