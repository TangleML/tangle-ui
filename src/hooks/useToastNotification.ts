import { useCallback, useRef } from "react";
import { Bounce, type Id, toast } from "react-toastify";

const useToastNotification = () => {
  const toastId = useRef<Id | null>(null);

  const notify = useCallback(
    (
      message: string | React.ReactNode,
      type: "success" | "warning" | "error" | "info" = "info",
    ) => {
      toastId.current = toast(message, {
        position: "bottom-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
        transition: Bounce,
        type,
      });
    },
    [],
  );

  return notify;
};

export default useToastNotification;
