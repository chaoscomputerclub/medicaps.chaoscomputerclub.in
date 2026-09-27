import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import portalReducer from "./slices/portalSlice";
import uiReducer from "./slices/uiSlice";
import assessmentReducer from "./slices/assessmentSlice";
import socialReducer from "./slices/socialSlice";
import contestReducer from "./slices/contestSlice";
import { baseApi } from "./api/baseApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    portal: portalReducer,
    ui: uiReducer,
    assessment: assessmentReducer,
    social: socialReducer,
    contest: contestReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore RTK Query internal actions
        ignoredActions: ["api/executeQuery/fulfilled", "api/executeMutation/fulfilled"],
      },
    }).concat(baseApi.middleware),
  devTools: Boolean(typeof import.meta !== "undefined" && (import.meta as any).env?.DEV),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { setTokenDirect, logout } from "./slices/authSlice";
import { initAuthKeepalive } from "@/lib/auth";

if (typeof window !== "undefined") {
  window.addEventListener("ccc:token-refreshed", (e: any) => {
    const token = e.detail?.token;
    if (token) {
      store.dispatch(setTokenDirect(token));
    }
  });

  window.addEventListener("ccc:session-invalidated", () => {
    store.dispatch(logout());
    store.dispatch(baseApi.util.resetApiState());
  });

  initAuthKeepalive();
}
