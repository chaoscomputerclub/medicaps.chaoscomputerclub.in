import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface UiState {
  sidebarOpen: boolean;
  activeModal: string | null;
  theme: "dark" | "light" | "system";
  isEditProfileOpen: boolean;
  globalLoading: boolean;
  globalLoadingLabel: string | null;
}

const initialState: UiState = {
  sidebarOpen: false,
  activeModal: null,
  theme: "dark",
  isEditProfileOpen: false,
  globalLoading: false,
  globalLoadingLabel: null,
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
    showGlobalLoader(state, action: PayloadAction<string | undefined>) {
      state.globalLoading = true;
      state.globalLoadingLabel = action.payload || null;
    },
    hideGlobalLoader(state) {
      state.globalLoading = false;
      state.globalLoadingLabel = null;
    },
    setGlobalLoading(state, action: PayloadAction<{ loading: boolean; label?: string | null | undefined }>) {
      state.globalLoading = action.payload.loading;
      state.globalLoadingLabel = action.payload.label || null;
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
  showGlobalLoader,
  hideGlobalLoader,
  setGlobalLoading,
} = uiSlice.actions;

export default uiSlice.reducer;
