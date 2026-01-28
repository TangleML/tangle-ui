import type { icons } from "lucide-react";
import { Activity, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

type FormFieldAction = {
  icon: keyof typeof icons;
  disabled?: boolean;
  hidden?: boolean;
  onClick: () => void;
};

const FormField = ({
  label,
  id,
  actions,
  labelSuffix,
  children,
}: {
  label: string;
  id: string;
  actions?: FormFieldAction[];
  labelSuffix?: ReactNode;
  children: ReactNode;
}) => (
  <BlockStack>
    <InlineStack align="space-between" className="w-full mb-1">
      <InlineStack gap="2">
        <label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </label>
        {labelSuffix}
      </InlineStack>
      <InlineStack gap="1">
        {actions?.map(
          (action) =>
            !action.hidden && (
              <Button
                key={action.icon}
                variant="ghost"
                onClick={action.onClick}
                disabled={action.disabled}
                size="min"
              >
                <Icon name={action.icon} size="xs" />
              </Button>
            ),
        )}
      </InlineStack>
    </InlineStack>
    {children}
  </BlockStack>
);

const NameField = ({
  inputName,
  onNameChange,
  onBlur,
  error,
  disabled,
  autoFocus = false,
}: {
  inputName: string;
  onNameChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
}) => (
  <FormField label="Name" id={`input-name-${inputName}`}>
    <Input
      id={`input-name-${inputName}`}
      disabled={disabled}
      type="text"
      value={inputName}
      onChange={(e) => onNameChange(e.target.value)}
      onBlur={onBlur}
      className={cn("text-sm", {
        "border-red-500 focus:border-red-500": !!error,
      })}
      autoFocus={autoFocus}
    />
    <Activity mode={error ? "visible" : "hidden"}>
      <div className="text-xs text-red-500 mt-1">{error}</div>
    </Activity>
  </FormField>
);

const DescriptionField = ({
  inputName,
  inputDescription,
  onChange,
  onBlur,
  disabled,
}: {
  inputName: string;
  inputDescription: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}) => (
  <FormField label="Description" id={`input-description-${inputName}`}>
    <Textarea
      id={`input-description-${inputName}`}
      disabled={disabled}
      value={inputDescription}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className="text-sm"
    />
  </FormField>
);

const TextField = ({
  inputValue,
  onInputChange,
  onBlur,
  placeholder,
  disabled,
  inputName,
  actions,
  isDefault = true,
}: {
  inputValue: string;
  onInputChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  disabled: boolean;
  inputName: string;
  actions?: FormFieldAction[];
  isDefault?: boolean;
}) => (
  <FormField
    label="Value"
    id={`input-value-${inputName}`}
    actions={actions}
    labelSuffix={
      isDefault ? (
        <InlineStack gap="1" className="ml-2">
          <Icon
            name="SquareCheckBig"
            size="sm"
            className="text-muted-foreground"
          />

          <Paragraph tone="subdued" size="xs">
            Use as default
          </Paragraph>
        </InlineStack>
      ) : null
    }
  >
    <Textarea
      id={`input-value-${inputName}`}
      value={inputValue}
      onChange={(e) => onInputChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      className="text-sm"
    />
  </FormField>
);

const TypeField = ({
  inputValue,
  onInputChange,
  onBlur,
  placeholder,
  disabled,
  inputName,
}: {
  inputValue: string;
  onInputChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  disabled?: boolean;
  inputName: string;
}) => (
  <FormField label="Type" id={`input-type-${inputName}`}>
    <Input
      id={`input-type-${inputName}`}
      value={inputValue}
      onChange={(e) => onInputChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      className="text-sm"
    />
  </FormField>
);

export { DescriptionField, NameField, TextField, TypeField };
