import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import type { JWTPayload } from "./types";

export function Avatar({
  profile,
  className,
}: {
  profile: JWTPayload;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0",
        className,
      )}
    >
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={`${profile.login} avatar`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to a default avatar if image fails to load
            e.currentTarget.src = `https://github.com/identicons/${profile.login}.png`;
          }}
        />
      ) : (
        <Icon name="User" size="fill" />
      )}
    </div>
  );
}
