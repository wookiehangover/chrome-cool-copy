import { useParams } from "react-router-dom";

export function SharePage() {
  const { shareId } = useParams<{ shareId: string }>();

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Share Page</h1>
          <p className="text-muted-foreground">
            Share ID: <code className="bg-secondary px-2 py-1 rounded">{shareId}</code>
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            This is a placeholder for the share viewer component.
          </p>
        </div>
      </div>
    </div>
  );
}

