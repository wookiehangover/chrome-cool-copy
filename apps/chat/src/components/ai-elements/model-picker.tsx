"use client";

import {
  MODELS_BY_PROVIDER,
  type ModelId,
  SUPPORTED_MODELS,
} from "@repo/shared";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export type ModelPickerProps = ComponentProps<typeof Select> & {
  value: ModelId;
  onValueChange: (model: ModelId) => void;
};

export const ModelPicker = ({
  value,
  onValueChange,
  ...props
}: ModelPickerProps) => (
  <Select value={value} onValueChange={onValueChange} {...props}>
    <ModelPickerTrigger value={value} />
    <ModelPickerContent />
  </Select>
);

export type ModelPickerTriggerProps = ComponentProps<typeof SelectTrigger> & {
  value: ModelId;
};

export const ModelPickerTrigger = ({
  value,
  className,
  ...props
}: ModelPickerTriggerProps) => {
  const selectedModel = SUPPORTED_MODELS.find((m) => m.id === value);

  return (
    <SelectTrigger
      className={cn(
        "border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors",
        "hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
        className
      )}
      {...props}
    >
      <SelectValue placeholder="Select model">
        {selectedModel?.displayName || "Select model"}
      </SelectValue>
    </SelectTrigger>
  );
};

export type ModelPickerContentProps = ComponentProps<typeof SelectContent>;

export const ModelPickerContent = ({
  className,
  ...props
}: ModelPickerContentProps) => (
  <SelectContent className={cn(className)} {...props}>
    {Object.entries(MODELS_BY_PROVIDER).map(([provider, models]) => (
      <SelectGroup key={provider}>
        <SelectLabel>{provider}</SelectLabel>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.displayName}
          </SelectItem>
        ))}
      </SelectGroup>
    ))}
  </SelectContent>
);

