"use client";

import { SUPPORTED_MODELS, type ModelId, type ModelDefinition } from "@repo/shared";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState, useRef, type ComponentProps } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { cn } from "@/lib/utils";

export type ModelPickerProps = Omit<ComponentProps<typeof Dialog>, "children"> & {
  value: ModelId;
  onValueChange: (model: ModelId) => void;
  disabled?: boolean;
};

function pricePerMillion(price: number | undefined) {
  if (price === undefined) return "Unknown";
  const amount = price * 1_000_000;
  if (!Number.isFinite(amount) || amount < 0) return "Unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(amount);
}

function ModelDetails({ model }: { model: ModelDefinition }) {
  return (
    <span className="text-muted-foreground text-xs">
      {model.contextWindow ? `${model.contextWindow.toLocaleString()} context` : "Context unknown"}
      {" · "}
      {pricePerMillion(model.inputPrice)} in / {pricePerMillion(model.outputPrice)} out per 1M
      {model.variablePricing ? " · Variable pricing" : ""}
    </span>
  );
}

export function ModelPicker({
  value,
  onValueChange,
  disabled,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: ModelPickerProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [localOpen, setLocalOpen] = useState(defaultOpen ?? false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("recommended");
  const [creator, setCreator] = useState("");
  const [reasoningOnly, setReasoningOnly] = useState(false);
  const catalog = useModelCatalog();
  const open = controlledOpen ?? localOpen;
  const selected =
    catalog.models.find((model) => model.id === value) ??
    SUPPORTED_MODELS.find((model) => model.id === value);
  const creators = [
    ...new Set(catalog.models.map((model) => model.creator ?? model.provider)),
  ].sort();
  const search = query.trim().toLowerCase();
  const matches = catalog.models.filter(
    (model) =>
      (view === "all" ||
        model.recommended === true ||
        (catalog.source === "fallback" && model.recommended !== false)) &&
      (!creator || (model.creator ?? model.provider) === creator) &&
      (!reasoningOnly || model.tags?.includes("reasoning")) &&
      [model.displayName, model.id, model.creator ?? model.provider].some((field) =>
        field.toLowerCase().includes(search),
      ),
  );
  const groups = [...new Set(matches.map((model) => model.creator ?? model.provider))];

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(next, details) => {
        setLocalOpen(next);
        if (!next) setQuery("");
        onOpenChange?.(next, details);
      }}
    >
      <DialogTrigger
        disabled={disabled}
        className="hover:bg-accent flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground"
      >
        <span className="truncate">{selected?.displayName ?? value}</span>
        <ChevronDownIcon className="size-4 shrink-0" />
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-2 overflow-y-auto p-3">
        <DialogClose ref={closeButton} className="hidden" />
        <DialogTitle className="pr-7">Choose a model</DialogTitle>
        <DialogDescription>
          Search compatible chat models. Availability depends on your Gateway account.
        </DialogDescription>
        <div className="flex flex-wrap gap-2 text-xs">
          <label className="flex items-center gap-1">
            Show
            <select
              aria-label="Model collection"
              value={view}
              onChange={(event) => setView(event.target.value)}
              className="bg-background rounded border p-1"
            >
              <option value="recommended">Recommended</option>
              <option value="all">All compatible</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Creator
            <select
              aria-label="Model creator"
              value={creator}
              onChange={(event) => setCreator(event.target.value)}
              className="bg-background max-w-40 rounded border p-1"
            >
              <option value="">All creators</option>
              {creators.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={reasoningOnly}
              onChange={(event) => setReasoningOnly(event.target.checked)}
            />
            Reasoning
          </label>
        </div>
        <div role="status" className="text-muted-foreground text-xs">
          {catalog.isLoading
            ? "Loading models…"
            : catalog.source === "cache"
              ? "Showing cached models."
              : catalog.source === "fallback"
                ? "Showing bundled models."
                : "Catalog up to date."}
          {catalog.fetchedAt && !catalog.isLoading
            ? ` Updated ${new Date(catalog.fetchedAt).toLocaleString()}.`
            : ""}
        </div>
        {catalog.error && (
          <p role="alert" className="text-destructive text-xs">
            {catalog.error}
          </p>
        )}
        <button
          type="button"
          className="justify-self-start text-xs underline disabled:opacity-50"
          disabled={catalog.isLoading}
          onClick={() => {
            void catalog.retry();
          }}
        >
          {catalog.error ? "Retry loading models" : "Refresh models"}
        </button>
        <p className="text-muted-foreground break-words text-xs">
          Selected: {selected?.displayName ?? value}
          {!catalog.models.some((model) => model.id === value)
            ? " — not in the current catalog; your choice is preserved."
            : ""}
        </p>
        <Command label="Search models" shouldFilter={false} loop>
          <CommandInput
            placeholder="Search name, ID, or creator…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[min(45vh,360px)]" aria-label="Compatible models">
            {matches.length === 0 && (
              <p className="p-4 text-center text-sm">
                No models match. Try All compatible or clear your filters.
              </p>
            )}
            {groups.map((name) => (
              <CommandGroup key={name} heading={name}>
                {matches
                  .filter((model) => (model.creator ?? model.provider) === name)
                  .map((model) => (
                    <CommandItem
                      key={model.id}
                      value={model.id}
                      onSelect={() => {
                        onValueChange(model.id);
                        closeButton.current?.click();
                      }}
                      className="items-start"
                    >
                      <CheckIcon
                        aria-label={value === model.id ? "Selected" : undefined}
                        className={cn("mt-0.5 size-4", value !== model.id && "invisible")}
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span>{model.displayName}</span>
                        <span className="text-muted-foreground break-all text-xs">{model.id}</span>
                        <ModelDetails model={model} />
                      </span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
