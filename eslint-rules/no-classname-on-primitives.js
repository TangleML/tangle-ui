/**
 * ESLint rule: no-classname-on-primitives
 *
 * Forbids the `className` attribute on Tangle UI primitives. Encourages using
 * semantic props (tone, truncate, align, italic, etc.) or layer-3 wrappers
 * (Surface, ListRow, ScrollRegion, Truncating, IconButton, ...).
 *
 * See `.local/.../ban-classname-on-primitives` plan.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Forbid className on Tangle UI primitives; use semantic props or layer-3 patterns",
      recommended: false,
    },
    schema: [
      {
        type: "object",
        properties: {
          components: {
            type: "array",
            items: { type: "string" },
            description: "Component names that should reject `className`.",
          },
          // Used to surface a friendlier message for the soft-banned Box primitive
          // (allowed, but warned-on in product code).
          softBanned: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noClassname:
        '<{{component}}> does not accept `className`. Use semantic props instead. See ".claude/skills/ui-primitives/SKILL.md".',
      softBanned:
        "<{{component}}> is the low-level escape hatch. Prefer a Layer-3 semantic primitive (Surface, ListRow, ScrollRegion, ...) when one fits. Acceptable as a last resort.",
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const banned = new Set(options.components ?? []);
    const softBanned = new Set(options.softBanned ?? []);

    return {
      JSXOpeningElement(node) {
        const nameNode = node.name;
        if (nameNode.type !== "JSXIdentifier") return;
        const name = nameNode.name;

        // Soft-ban: warn on any Box usage in this file glob.
        if (softBanned.has(name)) {
          context.report({
            node: nameNode,
            messageId: "softBanned",
            data: { component: name },
          });
        }

        if (!banned.has(name)) return;

        const classNameAttr = node.attributes.find(
          (attr) =>
            attr.type === "JSXAttribute" &&
            attr.name.type === "JSXIdentifier" &&
            attr.name.name === "className",
        );
        if (classNameAttr) {
          context.report({
            node: classNameAttr,
            messageId: "noClassname",
            data: { component: name },
          });
        }
      },
    };
  },
};

export default rule;
