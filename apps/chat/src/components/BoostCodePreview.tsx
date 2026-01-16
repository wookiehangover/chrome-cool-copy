import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { cn } from "@/lib/utils";

interface BoostCodePreviewProps {
  code: string | null;
  className?: string;
}

export function BoostCodePreview({ code, className }: BoostCodePreviewProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!code) {
    return null;
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn("border-b border-border", className)}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between rounded-none px-4 py-3 text-sm font-medium hover:bg-accent"
        >
          <span>Boost Code Preview</span>
          <ChevronDownIcon className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border bg-muted/30 p-4">
        <CodeBlock code={code} language="javascript" showLineNumbers />
      </CollapsibleContent>
    </Collapsible>
  );
}
