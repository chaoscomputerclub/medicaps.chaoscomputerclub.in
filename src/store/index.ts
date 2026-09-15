import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import portalReducer from "./slices/portalSlice";
import uiReducer from "./slices/uiSlice";
import assessmentReducer from "./slices/assessmentSlice";
import socialReducer from "./slices/socialSlice";
import contestReducer from "./slices/contestSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    portal: portalReducer,
    ui: uiReducer,
    assessment: assessmentReducer,
    social: socialReducer,
    contest: contestReducer,
  },
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
