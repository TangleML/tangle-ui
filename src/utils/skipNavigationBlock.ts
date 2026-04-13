let pending = false;

export const skipNextNavigationBlock = () => {
  pending = true;
};

export const consumeSkipNavigationBlock = () => {
  const was = pending;
  pending = false;
  return was;
};
