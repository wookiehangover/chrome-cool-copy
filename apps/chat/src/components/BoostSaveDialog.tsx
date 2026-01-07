import { useState, useEffect } from "react";
import type { Boost } from "@repo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface BoostSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (metadata: Omit<Boost, "id" | "code" | "createdAt" | "updatedAt">) => Promise<void>;
  defaultDomain: string;
  defaultName?: string;
  defaultDescription?: string;
  defaultRunMode?: "auto" | "manual";
  isLoading?: boolean;
  isEditMode?: boolean;
}

export function BoostSaveDialog({
  open,
  onOpenChange,
  onSave,
  defaultDomain,
  defaultName = "",
  defaultDescription = "",
  defaultRunMode = "manual",
  isLoading = false,
  isEditMode = false,
}: BoostSaveDialogProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [domain, setDomain] = useState(defaultDomain);
  const [runMode, setRunMode] = useState<"auto" | "manual">(defaultRunMode);
  const [error, setError] = useState<string | null>(null);

  // Update state when defaults change (e.g., when loading existing boost)
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription(defaultDescription);
      setRunMode(defaultRunMode);
      setDomain(defaultDomain);
    }
  }, [open, defaultName, defaultDescription, defaultRunMode, defaultDomain]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      setError(null);
      await onSave({
        name: name.trim(),
        description: description.trim(),
        domain: domain.trim(),
        runMode,
        enabled: true,
      });
      // Reset form
      setName("");
      setDescription("");
      setDomain(defaultDomain);
      setRunMode("manual");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save boost");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Update Boost" : "Save Boost"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update your boost settings"
              : "Save your boost with a name and configuration"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Highlight Headers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              placeholder="What does this boost do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              placeholder="e.g., github.com or *.github.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Run Mode</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="runMode"
                  value="auto"
                  checked={runMode === "auto"}
                  onChange={(e) => setRunMode(e.target.value as "auto" | "manual")}
                  disabled={isLoading}
                />
                <span className="text-sm">Run on page load</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="runMode"
                  value="manual"
                  checked={runMode === "manual"}
                  onChange={(e) => setRunMode(e.target.value as "auto" | "manual")}
                  disabled={isLoading}
                />
                <span className="text-sm">Run from command palette</span>
              </label>
            </div>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : isEditMode ? "Update Boost" : "Save Boost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

