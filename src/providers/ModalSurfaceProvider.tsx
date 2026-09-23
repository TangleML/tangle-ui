import { createContext, type ReactNode, useContext } from "react";

const ModalSurfaceContext = createContext(true);

interface ModalSurfaceProviderProps {
  modal: boolean;
  children: ReactNode;
}

export function ModalSurfaceProvider({
  modal,
  children,
}: ModalSurfaceProviderProps) {
  return <ModalSurfaceContext value={modal}>{children}</ModalSurfaceContext>;
}

export function useIsModalSurface(): boolean {
  return useContext(ModalSurfaceContext);
}
