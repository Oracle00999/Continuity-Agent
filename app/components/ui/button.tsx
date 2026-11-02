import {
  Button as ToolkitButton,
  type ButtonProps,
} from "@agent-native/toolkit/ui/button";
import { forwardRef, useRef } from "react";
export {
  buttonVariants,
  type ButtonProps,
} from "@agent-native/toolkit/ui/button";

/** Return focus after a suggestion is chosen so Enter cannot activate another chip. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    const selecting = useRef(false);
    const suggestion = (
      props as ButtonProps & { "data-agent-suggestion-chip"?: boolean | string }
    )["data-agent-suggestion-chip"];
    if (!suggestion) return <ToolkitButton {...props} ref={ref} />;
    return (
      <ToolkitButton
        {...props}
        ref={ref}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (event.key === "Enter" && (event.repeat || selecting.current)) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onClick={(event) => {
          if (selecting.current) {
            event.preventDefault();
            return;
          }
          selecting.current = true;
          const button = event.currentTarget;
          const scope =
            button.closest(
              ".agentkit-composer-stack, .agentkit-host-composer",
            ) ??
            button.closest(
              ".agent-sidebar-panel, [data-agent-chat-workspace-state]",
            );
          props.onClick?.(event);
          // Move focus synchronously, before a following Enter or regenerated chip can reuse it.
          const composer = scope?.querySelector<HTMLElement>(
            '.ProseMirror[contenteditable="true"], textarea:not([disabled])',
          );
          button.blur();
          composer?.focus({ preventScroll: true });
          queueMicrotask(() => {
            selecting.current = false;
          });
        }}
      />
    );
  },
);
Button.displayName = "Button";
