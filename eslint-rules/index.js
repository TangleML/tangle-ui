import noClassnameOnPrimitives from "./no-classname-on-primitives.js";

/**
 * Local ESLint plugin: tangle-ui.
 * Rules live in `./eslint-rules/*.js` and are wired into eslint.config.js.
 *
 * @type {import('eslint').ESLint.Plugin}
 */
const plugin = {
  meta: { name: "tangle-ui" },
  rules: {
    "no-classname-on-primitives": noClassnameOnPrimitives,
  },
};

export default plugin;
