import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import portalReducer from "./slices/portalSlice";
import uiReducer from "./slices/uiSlice";
import assessmentReducer from "./slices/assessmentSlice";
import socialReducer from "./slices/socialSlice";
import contestReducer from "./slices/contestSlice";

const appReducer = combineReducers({
  auth: authReducer,
  portal: portalReducer,
  ui: uiReducer,
  assessment: assessmentReducer,
  social: socialReducer,
  contest: contestReducer,
});

const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: any) => {
  if (action.type === "auth/logout") {
    // When logging out, completely wipe Redux state so no user data leaks across accounts.
    // Passing undefined forces every slice reducer to return its pristine initialState.
    state = undefined;
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof appReducer>;
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
  });

  initAuthKeepalive();
}
