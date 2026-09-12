/**
 * Chaos Computer Club India — Social Redux Slice
 * Manages peer following/followers state, drawer UI, and optimistic updates.
 */

import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { getApiBase, getToken } from "@/lib/auth";
import type { StudentFollowItem } from "@/organization/data/types";

export interface SocialState {
  followingIds: string[];
  drawerOpen: boolean;
  drawerType: "followers" | "following";
  drawerTargetHandle: string | null;
  drawerTargetName: string | null;
  studentsList: StudentFollowItem[];
  loadingList: boolean;
  actionPendingId: string | null;
  searchQuery: string;
  error: string | null;
}

const initialState: SocialState = {
  followingIds: [],
  drawerOpen: false,
  drawerType: "followers",
  drawerTargetHandle: null,
  drawerTargetName: null,
  studentsList: [],
  loadingList: false,
  actionPendingId: null,
  searchQuery: "",
  error: null,
};

// 1. Fetch current authenticated member's followed IDs
export const fetchMyFollowingIdsThunk = createAsyncThunk<string[]>(
  "social/fetchMyFollowingIds",
  async (_, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) return [];
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/social/my-following-ids`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.following_ids || [];
    } catch {
      return rejectWithValue("Failed to load following list.");
    }
  },
);

// 2. Fetch followers list for a student
export const fetchFollowersThunk = createAsyncThunk<StudentFollowItem[], string>(
  "social/fetchFollowers",
  async (target, { rejectWithValue }) => {
    try {
      const token = getToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/social/${encodeURIComponent(target)}/followers`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error("Failed to fetch followers");
      const data = await res.json();
      return data.students || [];
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to fetch followers");
    }
  },
);

// 3. Fetch following list for a student
export const fetchFollowingThunk = createAsyncThunk<StudentFollowItem[], string>(
  "social/fetchFollowing",
  async (target, { rejectWithValue }) => {
    try {
      const token = getToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/social/${encodeURIComponent(target)}/following`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error("Failed to fetch following");
      const data = await res.json();
      return data.students || [];
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to fetch following");
    }
  },
);

// 4. Toggle Follow / Unfollow
export const toggleFollowThunk = createAsyncThunk<
  {
    targetId: string;
    targetHandle: string;
    isFollowing: boolean;
    followersCount: number;
    followingCount: number;
  },
  { targetId: string; targetHandle: string }
>("social/toggleFollow", async ({ targetId, targetHandle }, { getState, rejectWithValue }) => {
  try {
    const token = getToken();
    if (!token) {
      window.location.href = "/auth";
      return rejectWithValue("Authentication required");
    }
    const apiBase = getApiBase();
    const state = getState() as { social: SocialState };
    const currentlyFollowing = state.social.followingIds.includes(targetId);

    const method = currentlyFollowing ? "DELETE" : "POST";
    const res = await fetch(`${apiBase}/social/follow/${encodeURIComponent(targetId)}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Action failed" }));
      return rejectWithValue(err.detail || "Action failed");
    }

    const data = await res.json();
    return {
      targetId,
      targetHandle,
      isFollowing: data.is_following,
      followersCount: data.followers_count,
      followingCount: data.following_count,
    };
  } catch (err: any) {
    return rejectWithValue(err?.message || "Failed to toggle follow status");
  }
});

export const socialSlice = createSlice({
  name: "social",
  initialState,
  reducers: {
    openSocialDrawer: (
      state,
      action: PayloadAction<{
        targetHandle: string;
        targetName?: string | null;
        type: "followers" | "following";
      }>,
    ) => {
      state.drawerOpen = true;
      state.drawerType = action.payload.type;
      state.drawerTargetHandle = action.payload.targetHandle;
      state.drawerTargetName = action.payload.targetName || action.payload.targetHandle;
      state.searchQuery = "";
      state.studentsList = [];
    },
    closeSocialDrawer: (state) => {
      state.drawerOpen = false;
      state.searchQuery = "";
    },
    setDrawerType: (state, action: PayloadAction<"followers" | "following">) => {
      state.drawerType = action.payload;
    },
    setSocialSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
  },
  extraReducers: (builder) => {
    // My Following IDs
    builder.addCase(fetchMyFollowingIdsThunk.fulfilled, (state, action) => {
      state.followingIds = action.payload;
    });

    // Followers List
    builder.addCase(fetchFollowersThunk.pending, (state) => {
      state.loadingList = true;
      state.error = null;
    });
    builder.addCase(fetchFollowersThunk.fulfilled, (state, action) => {
      state.loadingList = false;
      state.studentsList = action.payload;
    });
    builder.addCase(fetchFollowersThunk.rejected, (state, action) => {
      state.loadingList = false;
      state.error = action.payload as string;
    });

    // Following List
    builder.addCase(fetchFollowingThunk.pending, (state) => {
      state.loadingList = true;
      state.error = null;
    });
    builder.addCase(fetchFollowingThunk.fulfilled, (state, action) => {
      state.loadingList = false;
      state.studentsList = action.payload;
    });
    builder.addCase(fetchFollowingThunk.rejected, (state, action) => {
      state.loadingList = false;
      state.error = action.payload as string;
    });

    // Toggle Follow: Optimistic
    builder.addCase(toggleFollowThunk.pending, (state, action) => {
      const { targetId } = action.meta.arg;
      state.actionPendingId = targetId;
      if (state.followingIds.includes(targetId)) {
        state.followingIds = state.followingIds.filter((id) => id !== targetId);
      } else {
        state.followingIds.push(targetId);
      }
      // Also update in current modal list if visible
      const item = state.studentsList.find((s) => s.id === targetId);
      if (item) {
        item.is_following = !item.is_following;
      }
    });
    builder.addCase(toggleFollowThunk.fulfilled, (state, action) => {
      state.actionPendingId = null;
      const { targetId, isFollowing } = action.payload;
      if (isFollowing && !state.followingIds.includes(targetId)) {
        state.followingIds.push(targetId);
      } else if (!isFollowing && state.followingIds.includes(targetId)) {
        state.followingIds = state.followingIds.filter((id) => id !== targetId);
      }
      const item = state.studentsList.find((s) => s.id === targetId);
      if (item) {
        item.is_following = isFollowing;
      }
    });
    builder.addCase(toggleFollowThunk.rejected, (state, action) => {
      state.actionPendingId = null;
      // Rollback on rejection
      const { targetId } = action.meta.arg;
      if (state.followingIds.includes(targetId)) {
        state.followingIds = state.followingIds.filter((id) => id !== targetId);
      } else {
        state.followingIds.push(targetId);
      }
      const item = state.studentsList.find((s) => s.id === targetId);
      if (item) {
        item.is_following = !item.is_following;
      }
    });
  },
});

export const { openSocialDrawer, closeSocialDrawer, setDrawerType, setSocialSearchQuery } =
  socialSlice.actions;

export default socialSlice.reducer;
