import { type NodeProps } from "@xyflow/react";
import { memo } from "react";

import { cn } from "@/lib/utils";

const CommentNode = memo(({ data }: NodeProps) => {
  const typedData = data as { message: string };
  return (
    <div
      className={cn(
        "border-2 border-dashed border-gray-400/60 rounded-lg p-2 bg-gray-100",
        "dark:border-gray-600/60 dark:bg-gray-800",
        "min-w-[120px] min-h-[60px] flex items-center justify-center",
        "text-sm text-gray-600 dark:text-gray-300",
      )}
    >
      <p>{typedData.message}</p>
    </div>
  );
});

CommentNode.displayName = "CommentNode";

export default CommentNode;
