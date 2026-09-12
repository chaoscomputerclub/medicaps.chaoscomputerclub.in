import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import portalReducer from "./slices/portalSlice";
import uiReducer from "./slices/uiSlice";
import assessmentReducer from "./slices/assessmentSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    portal: portalReducer,
    ui: uiReducer,
    assessment: assessmentReducer,
  },
  devTools: process.env.NODE_ENV !== "production",
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
