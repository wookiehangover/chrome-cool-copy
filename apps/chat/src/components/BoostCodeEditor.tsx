import { useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { cn } from "@/lib/utils";

interface BoostCodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  className?: string;
  readOnly?: boolean;
}

export function BoostCodeEditor({
  code,
  onChange,
  className,
  readOnly = false,
}: BoostCodeEditorProps) {
  const handleChange = useCallback(
    (value: string) => {
      onChange(value);
    },
    [onChange],
  );

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      <CodeMirror
        value={code}
        onChange={handleChange}
        extensions={[javascript()]}
        readOnly={readOnly}
        theme="dark"
        className="flex-1 overflow-auto text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
        height="100%"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          indentOnInput: true,
        }}
      />
    </div>
  );
}
