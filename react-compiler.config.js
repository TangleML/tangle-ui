// React Compiler: Directory-based incremental adoption
// Add directories here as they are cleaned up for compiler compatibility
export const REACT_COMPILER_ENABLED_DIRS = [
  "src/components/Home",
  "src/components/Editor",
  // Add more directories as you clean them up:
  // "src/components/shared/",
  // "src/hooks/",
];

// Convert to glob patterns for ESLint
export const REACT_COMPILER_ENABLED_GLOBS = REACT_COMPILER_ENABLED_DIRS.map(
  (dir) => `${dir}/**/*.{ts,tsx}`,
);
