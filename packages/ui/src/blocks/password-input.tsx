"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/ui/components/input-group";
import { cn } from "@repo/ui/lib/utils";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  containerClassName?: string;
};

const iconMotion =
  "absolute inset-0 size-full transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]";

function PasswordInput({
  containerClassName,
  disabled,
  id,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup className={containerClassName}>
      <InputGroupInput
        disabled={disabled}
        id={id}
        type={visible ? "text" : "password"}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-controls={id}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="relative rounded-full text-muted-foreground before:absolute before:inset-[-10px] before:content-[''] hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
          onMouseDown={(event) => event.preventDefault()}
          size="icon-xs"
        >
          <span className="size-3.5 relative shrink-0" aria-hidden="true">
            <EyeIcon
              className={cn(
                iconMotion,
                visible
                  ? "scale-[0.25] opacity-0 blur-[4px]"
                  : "scale-100 opacity-100 blur-none",
              )}
              strokeWidth={1.5}
            />
            <EyeOffIcon
              className={cn(
                iconMotion,
                visible
                  ? "scale-100 opacity-100 blur-none"
                  : "scale-[0.25] opacity-0 blur-[4px]",
              )}
              strokeWidth={1.5}
            />
          </span>
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

export { PasswordInput };
export type { PasswordInputProps };
