import type {
  AnchorProtocolMap,
  AnchorProtocolProps,
} from "@tangent/embed-react";

import { ChatEntityChip } from "./ChatEntityChip";
import { useOptionalChatEntityReveal } from "./ChatEntityRevealContext";
import { ComponentChipFromContext } from "./ComponentChipFromContext";
import { entityIcon } from "./entityIcon";
import { chatEntityKindFromId } from "./resolveChatEntity";

function EntityAnchor({ path, label }: AnchorProtocolProps) {
  const reveal = useOptionalChatEntityReveal();

  return (
    <ChatEntityChip
      icon={entityIcon(chatEntityKindFromId(path))}
      label={label}
      onClick={() => reveal?.revealEntity(path, label)}
    />
  );
}

function ComponentAnchor({ path, label }: AnchorProtocolProps) {
  return <ComponentChipFromContext componentId={path} label={label} />;
}

/**
 * Host-owned anchor renderers for the embedded `<Chat>`: markdown links using
 * the `entity://` and `component://` protocols render chips instead of plain
 * links. An entity chip hands off to the project's reveal context (which
 * activates the owning workarea pipeline tab and focuses the entity); a
 * component chip hydrates by digest.
 */
export const chatAnchorProtocols: AnchorProtocolMap = {
  entity: EntityAnchor,
  component: ComponentAnchor,
};
