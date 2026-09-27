import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showGlobalLoader, hideGlobalLoader, setGlobalLoading } from "@/store/slices/uiSlice";

/**
 * Hook to access and control the global tactical glowing loader across any component or page.
 */
export function useGlobalLoader() {
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector((state) => state.ui.globalLoading);
  const label = useAppSelector((state) => state.ui.globalLoadingLabel);

  const show = useCallback(
    (text?: string) => {
      dispatch(showGlobalLoader(text));
    },
    [dispatch]
  );

  const hide = useCallback(() => {
    dispatch(hideGlobalLoader());
  }, [dispatch]);

  const setLoading = useCallback(
    (loading: boolean, text?: string) => {
      dispatch(setGlobalLoading({ loading, label: text }));
    },
    [dispatch]
  );

  return {
    isLoading,
    label,
    show,
    hide,
    setLoading,
  };
}
