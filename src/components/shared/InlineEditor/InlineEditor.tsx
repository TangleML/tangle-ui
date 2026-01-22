import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";

export const InlineEditor = ({
  value,
  editor,
}: {
  value: ReactNode;
  editor: ReactNode;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      setIsEditing(true);
    }
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    // Only exit edit mode if focus moves outside the container
    if (!containerRef.current?.contains(event.relatedTarget)) {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="w-full" ref={containerRef} onBlur={onBlur}>
        {editor}
      </div>
    );
  }

  return (
    <div
      className="w-full cursor-pointer whitespace-pre-wrap rounded-md border border-transparent px-3 py-2 text-sm hover:border-input hover:bg-muted/50"
      onClick={() => setIsEditing(true)}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={0}
      title="Click to edit"
    >
      {value}
    </div>
  );
};
