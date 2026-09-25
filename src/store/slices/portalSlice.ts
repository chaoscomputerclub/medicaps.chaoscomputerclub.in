import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface PortalState {
  activeContestSlug: string | null;
  divisionFilter: "all" | "division_1" | "division_2" | "division_3" | "overall";
  statusFilter: "all" | "live" | "upcoming" | "finished";
  searchQuery: string;
  bookmarkedProblems: string[];
  activeTab: string;
  leaderboardSearch: string;
  leaderboardDept: string;
  leaderboardBatch: string;
}

const initialBookmarks: string[] = (() => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("ccc_bookmarked_problems");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
})();

const initialState: PortalState = {
  activeContestSlug: null,
  divisionFilter: "all",
  statusFilter: "all",
  searchQuery: "",
  bookmarkedProblems: initialBookmarks,
  activeTab: "overview",
  leaderboardSearch: "",
  leaderboardDept: "all",
  leaderboardBatch: "all",
};

export const portalSlice = createSlice({
  name: "portal",
  initialState,
  reducers: {
    setActiveContestSlug(state, action: PayloadAction<string | null>) {
      state.activeContestSlug = action.payload;
    },
    setDivisionFilter(
      state,
      action: PayloadAction<"all" | "division_1" | "division_2" | "division_3" | "overall">,
    ) {
      state.divisionFilter = action.payload;
    },
    setStatusFilter(state, action: PayloadAction<"all" | "live" | "upcoming" | "finished">) {
      state.statusFilter = action.payload;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setActiveTab(state, action: PayloadAction<string>) {
      state.activeTab = action.payload;
    },
    toggleBookmarkProblem(state, action: PayloadAction<string>) {
      const slug = action.payload;
      if (state.bookmarkedProblems.includes(slug)) {
        state.bookmarkedProblems = state.bookmarkedProblems.filter((p) => p !== slug);
      } else {
        state.bookmarkedProblems.push(slug);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("ccc_bookmarked_problems", JSON.stringify(state.bookmarkedProblems));
      }
    },
    setLeaderboardSearch(state, action: PayloadAction<string>) {
      state.leaderboardSearch = action.payload;
    },
    setLeaderboardDept(state, action: PayloadAction<string>) {
      state.leaderboardDept = action.payload;
    },
    setLeaderboardBatch(state, action: PayloadAction<string>) {
      state.leaderboardBatch = action.payload;
    },
  },
});

export const {
  setActiveContestSlug,
  setDivisionFilter,
  setStatusFilter,
  setSearchQuery,
  setActiveTab,
  toggleBookmarkProblem,
  setLeaderboardSearch,
  setLeaderboardDept,
  setLeaderboardBatch,
} = portalSlice.actions;

export default portalSlice.reducer;
