import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface UiState {
  sidebarOpen: boolean;
  activeModal: string | null;
  theme: "dark" | "light" | "system";
}

const initialState: UiState = {
  sidebarOpen: false,
  activeModal: null,
  theme: "dark",
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    openModal(state, action: PayloadAction<string>) {
      state.activeModal = action.payload;
    },
    closeModal(state) {
      state.activeModal = null;
    },
    setTheme(state, action: PayloadAction<"dark" | "light" | "system">) {
      state.theme = action.payload;
    },
  },
});

export const { toggleSidebar, setSidebarOpen, openModal, closeModal, setTheme } = uiSlice.actions;

export default uiSlice.reducer;
