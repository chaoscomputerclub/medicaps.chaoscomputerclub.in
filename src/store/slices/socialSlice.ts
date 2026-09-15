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
      const cleanTarget = target.replace(/^@+/, "").trim();
      if (!cleanTarget) return [];
      const token = getToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/social/${encodeURIComponent(cleanTarget)}/followers`, {
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
      const cleanTarget = target.replace(/^@+/, "").trim();
      if (!cleanTarget) return [];
      const token = getToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/social/${encodeURIComponent(cleanTarget)}/following`, {
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
  { targetId?: string; targetHandle?: string } | string
>("social/toggleFollow", async (arg, { getState, rejectWithValue }) => {
  try {
    const token = getToken();
    if (!token) {
      window.location.href = "/auth";
      return rejectWithValue("Authentication required");
    }
    const target = typeof arg === "string" ? arg : (arg.targetHandle || arg.targetId || "");
    const cleanTarget = target.replace(/^@+/, "").trim();
    if (!cleanTarget) return rejectWithValue("Target student handle is required.");

    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/social/follow/${encodeURIComponent(cleanTarget)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      // If already following, try DELETE to unfollow
      const delRes = await fetch(`${apiBase}/social/follow/${encodeURIComponent(cleanTarget)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!delRes.ok) {
        const err = await delRes.json().catch(() => ({ detail: "Action failed" }));
        return rejectWithValue(err.detail || "Action failed");
      }
      const data = await delRes.json();
      return {
        targetId: (typeof arg === "object" && arg.targetId) || cleanTarget,
        targetHandle: data.target_handle || cleanTarget,
        isFollowing: false,
        followersCount: data.followers_count ?? 0,
        followingCount: data.following_count ?? 0,
      };
    }

    const data = await res.json();
    return {
      targetId: (typeof arg === "object" && arg.targetId) || cleanTarget,
      targetHandle: data.target_handle || cleanTarget,
      isFollowing: Boolean(data.is_following),
      followersCount: data.followers_count ?? 0,
      followingCount: data.following_count ?? 0,
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
        targetHandle?: string;
        handle?: string;
        target?: string;
        targetName?: string | null;
        name?: string | null;
        type?: "followers" | "following";
        mode?: "followers" | "following";
      } | string>,
    ) => {
      const payload = typeof action.payload === "string" ? { handle: action.payload } : action.payload;
      const rawHandle = payload.targetHandle || payload.handle || payload.target || "";
      const cleanHandle = rawHandle.replace(/^@+/, "").trim();
      const rawName = payload.targetName || payload.name || cleanHandle;
      const drawerType = payload.type || payload.mode || "followers";

      state.drawerOpen = true;
      state.drawerType = drawerType;
      state.drawerTargetHandle = cleanHandle;
      state.drawerTargetName = rawName || cleanHandle;
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
      const arg = action.meta.arg;
      const targetKey = typeof arg === "string" ? arg : (arg.targetId || arg.targetHandle || "");
      state.actionPendingId = targetKey;
      if (state.followingIds.includes(targetKey)) {
        state.followingIds = state.followingIds.filter((id) => id !== targetKey);
      } else {
        state.followingIds.push(targetKey);
      }
      // Also update in current modal list if visible
      const item = state.studentsList.find((s) => s.id === targetKey || s.handle === targetKey);
      if (item) {
        item.is_following = !item.is_following;
      }
    });
    builder.addCase(toggleFollowThunk.fulfilled, (state, action) => {
      state.actionPendingId = null;
      const { targetId, targetHandle, isFollowing } = action.payload;
      if (isFollowing) {
        if (targetId && !state.followingIds.includes(targetId)) state.followingIds.push(targetId);
        if (targetHandle && !state.followingIds.includes(targetHandle)) state.followingIds.push(targetHandle);
      } else {
        state.followingIds = state.followingIds.filter((id) => id !== targetId && id !== targetHandle);
      }
      const item = state.studentsList.find((s) => s.id === targetId || s.handle === targetHandle);
      if (item) {
        item.is_following = isFollowing;
      }
    });
    builder.addCase(toggleFollowThunk.rejected, (state, action) => {
      state.actionPendingId = null;
      // Rollback on rejection
      const arg = action.meta.arg;
      const targetKey = typeof arg === "string" ? arg : (arg.targetId || arg.targetHandle || "");
      if (state.followingIds.includes(targetKey)) {
        state.followingIds = state.followingIds.filter((id) => id !== targetKey);
      } else {
        state.followingIds.push(targetKey);
      }
      const item = state.studentsList.find((s) => s.id === targetKey || s.handle === targetKey);
      if (item) {
        item.is_following = !item.is_following;
      }
    });
  },
});

export const { openSocialDrawer, closeSocialDrawer, setDrawerType, setSocialSearchQuery } =
  socialSlice.actions;

export default socialSlice.reducer;
