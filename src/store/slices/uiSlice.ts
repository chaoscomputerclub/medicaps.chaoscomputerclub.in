import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface UiState {
  sidebarOpen: boolean;
  activeModal: string | null;
  theme: "dark" | "light" | "system";
  isEditProfileOpen: boolean;
}

const initialState: UiState = {
  sidebarOpen: false,
  activeModal: null,
  theme: "dark",
  isEditProfileOpen: false,
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
    openEditProfileModal(state) {
      state.isEditProfileOpen = true;
    },
    closeEditProfileModal(state) {
      state.isEditProfileOpen = false;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  openModal,
  closeModal,
  setTheme,
  openEditProfileModal,
  closeEditProfileModal,
} = uiSlice.actions;

export default uiSlice.reducer;
