import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  getToken,
  getStoredMember,
  setStoredMember,
  setToken as persistToken,
  clearToken as removePersistedToken,
  sendOTP,
  verifyOTP,
  getMe,
  completeOnboarding,
  updateProfile,
  checkHandle,
  deleteAccount,
  type Member,
  type AuthResult,
  type UpdateProfilePayload,
  type CompleteOnboardingPayload,
} from "@/lib/auth";

export interface AuthState {
  member: Member | null;
  token: string | null;
  isAuthenticated: boolean;
  step: "email" | "otp" | "onboarding";
  email: string;
  transactionId: string | null;
  otp: string;
  name: string;
  handle: string;
  prn: string;
  department: string;
  batch: string;
  pending: boolean;
  message: string | null;
  devOtp: string | null;
  handleStatus: "idle" | "checking" | "available" | "taken";
}

const initialToken = typeof window !== "undefined" ? getToken() : null;
const initialMember = typeof window !== "undefined" ? getStoredMember() : null;

const initialState: AuthState = {
  member: initialMember,
  token: initialToken,
  isAuthenticated: Boolean(initialToken),
  step: "email",
  email: initialMember?.email || "",
  transactionId: null,
  otp: "",
  name: initialMember?.full_name || "",
  handle: initialMember?.handle || "",
  prn: initialMember?.prn || "",
  department: initialMember?.department || "CSE",
  batch: initialMember?.batch || "2023-27",
  pending: false,
  message: null,
  devOtp: null,
  handleStatus: "idle",
};

// Async Thunks
export const sendOtpThunk = createAsyncThunk<
  { sent: boolean; email: string; transaction_id?: string; dev_otp?: string },
  string,
  { rejectValue: string }
>("auth/sendOtp", async (email, { rejectWithValue }) => {
  try {
    return await sendOTP(email.trim().toLowerCase());
  } catch (err: any) {
    return rejectWithValue(err?.message || "Failed to send verification code.");
  }
});

export const verifyOtpThunk = createAsyncThunk<
  AuthResult,
  { email: string; code: string; transaction_id?: string },
  { rejectValue: string }
>("auth/verifyOtp", async ({ email, code, transaction_id }, { rejectWithValue }) => {
  try {
    const res = await verifyOTP(email.trim().toLowerCase(), code.trim(), transaction_id);
    persistToken(res.access_token, res.member);
    return res;
  } catch (err: any) {
    return rejectWithValue(err?.message || "Invalid or expired code. Please check and try again.");
  }
});

export const fetchCurrentUserThunk = createAsyncThunk<Member, void, { rejectValue: string }>(
  "auth/fetchCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const res = await getMe();
      return res.member;
    } catch (err: any) {
      // ONLY clear the token if the server explicitly rejected authentication with 401
      const isAuthExpired =
        err?.status === 401 ||
        (typeof err?.message === "string" &&
          (err.message.toLowerCase().includes("authentication required") ||
            err.message.toLowerCase().includes("invalid token") ||
            err.message.toLowerCase().includes("jwt expired")));

      if (isAuthExpired) {
        removePersistedToken();
        return rejectWithValue(err?.message || "Session expired. Please sign in again.");
      }

      return rejectWithValue(err?.message || "Unable to refresh user profile.");
    }
  },
);

export const completeOnboardingThunk = createAsyncThunk<
  Member,
  CompleteOnboardingPayload,
  { rejectValue: string }
>("auth/completeOnboarding", async (data, { rejectWithValue }) => {
  try {
    const res = await completeOnboarding(data);
    return res.member;
  } catch (err: any) {
    return rejectWithValue(err?.message || "Failed to complete onboarding.");
  }
});

export const checkHandleThunk = createAsyncThunk<
  { available: boolean; handle: string; reason?: string },
  string,
  { rejectValue: string }
>("auth/checkHandle", async (handle, { rejectWithValue }) => {
  try {
    return await checkHandle(handle);
  } catch (err: any) {
    return rejectWithValue(err?.message || "Failed to check handle availability.");
  }
});

export const deleteAccountThunk = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>("auth/deleteAccount", async (_, { rejectWithValue }) => {
  try {
    await deleteAccount();
    removePersistedToken();
    return;
  } catch (err: any) {
    return rejectWithValue(err?.message || "Failed to delete account.");
  }
});

export const updateProfileThunk = createAsyncThunk<
  Member,
  UpdateProfilePayload,
  { rejectValue: string }
>("auth/updateProfile", async (data, { rejectWithValue }) => {
  try {
    const res = await updateProfile(data);
    return res.member;
  } catch (err: any) {
    return rejectWithValue(err?.message || "Failed to update profile.");
  }
});

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setEmail(state, action: PayloadAction<string>) {
      state.email = action.payload;
    },
    setOtp(state, action: PayloadAction<string>) {
      state.otp = action.payload;
    },
    setName(state, action: PayloadAction<string>) {
      state.name = action.payload;
    },
    setHandle(state, action: PayloadAction<string>) {
      state.handle = action.payload;
    },
    setHandleStatus(state, action: PayloadAction<"idle" | "checking" | "available" | "taken">) {
      state.handleStatus = action.payload;
    },
    setPrn(state, action: PayloadAction<string>) {
      state.prn = action.payload;
    },
    setDepartment(state, action: PayloadAction<string>) {
      state.department = action.payload;
    },
    setBatch(state, action: PayloadAction<string>) {
      state.batch = action.payload;
    },
    setStep(state, action: PayloadAction<"email" | "otp" | "onboarding">) {
      state.step = action.payload;
    },
    setMessage(state, action: PayloadAction<string | null>) {
      state.message = action.payload;
    },
    setDevOtp(state, action: PayloadAction<string | null>) {
      state.devOtp = action.payload;
    },
    setTokenDirect(state, action: PayloadAction<string>) {
      state.token = action.payload;
      state.isAuthenticated = true;
      persistToken(action.payload);
    },
    logout(state) {
      removePersistedToken();
      state.token = null;
      state.member = null;
      state.isAuthenticated = false;
      state.step = "email";
      state.email = "";
      state.otp = "";
      state.message = null;
      state.devOtp = null;
    },
  },
  extraReducers: (builder) => {
    // sendOtpThunk
    builder.addCase(sendOtpThunk.pending, (state) => {
      state.pending = true;
      state.message = null;
    });
    builder.addCase(sendOtpThunk.fulfilled, (state, action) => {
      state.pending = false;
      state.step = "otp";
      if (action.payload.transaction_id) {
        state.transactionId = action.payload.transaction_id;
      }
      if (action.payload.dev_otp) {
        state.devOtp = action.payload.dev_otp;
      }
      state.message = null;
    });
    builder.addCase(sendOtpThunk.rejected, (state, action) => {
      state.pending = false;
      state.message = action.payload || "Failed to send code.";
    });

    // verifyOtpThunk
    builder.addCase(verifyOtpThunk.pending, (state) => {
      state.pending = true;
      state.message = null;
    });
    builder.addCase(verifyOtpThunk.fulfilled, (state, action) => {
      state.pending = false;
      state.token = action.payload.access_token;
      state.isAuthenticated = true;
      state.member = action.payload.member;
      if (action.payload.member) {
        setStoredMember(action.payload.member);
        if (action.payload.member.full_name) state.name = action.payload.member.full_name;
        if (action.payload.member.handle) state.handle = action.payload.member.handle;
      }
      if (action.payload.is_new_user || !action.payload.member?.is_onboarded) {
        state.step = "onboarding";
      }
      state.message = null;
    });
    builder.addCase(verifyOtpThunk.rejected, (state, action) => {
      state.pending = false;
      state.message = action.payload || "Verification failed.";
    });

    // fetchCurrentUserThunk
    builder.addCase(fetchCurrentUserThunk.fulfilled, (state, action) => {
      state.member = action.payload;
      state.isAuthenticated = true;
      setStoredMember(action.payload);
      if (action.payload.full_name) state.name = action.payload.full_name;
      if (action.payload.handle) state.handle = action.payload.handle;
      if (!action.payload.is_onboarded) {
        state.step = "onboarding";
      }
    });
    builder.addCase(fetchCurrentUserThunk.rejected, (state) => {
      if (!getToken()) {
        state.member = null;
        state.token = null;
        state.isAuthenticated = false;
        setStoredMember(null);
      }
    });

    // completeOnboardingThunk
    builder.addCase(completeOnboardingThunk.pending, (state) => {
      state.pending = true;
      state.message = null;
    });
    builder.addCase(completeOnboardingThunk.fulfilled, (state, action) => {
      state.pending = false;
      state.member = action.payload;
      setStoredMember(action.payload);
      state.message = null;
    });
    builder.addCase(completeOnboardingThunk.rejected, (state, action) => {
      state.pending = false;
      state.message = action.payload || "Onboarding failed.";
    });

    // updateProfileThunk
    builder.addCase(updateProfileThunk.pending, (state) => {
      state.pending = true;
      state.message = null;
    });
    builder.addCase(updateProfileThunk.fulfilled, (state, action) => {
      state.pending = false;
      const updated = { ...(state.member || {}), ...action.payload } as Member;
      state.member = updated;
      setStoredMember(updated);
      if (action.payload.full_name) state.name = action.payload.full_name;
      if (action.payload.department) state.department = action.payload.department;
      if (action.payload.batch) state.batch = action.payload.batch;
      state.message = null;
    });
    builder.addCase(updateProfileThunk.rejected, (state, action) => {
      state.pending = false;
      state.message = action.payload || "Failed to update profile.";
    });

    // checkHandleThunk
    builder.addCase(checkHandleThunk.pending, (state) => {
      state.handleStatus = "checking";
    });
    builder.addCase(checkHandleThunk.fulfilled, (state, action) => {
      state.handleStatus = action.payload.available ? "available" : "taken";
    });
    builder.addCase(checkHandleThunk.rejected, (state) => {
      state.handleStatus = "idle";
    });

    // deleteAccountThunk
    builder.addCase(deleteAccountThunk.fulfilled, (state) => {
      state.member = null;
      state.token = null;
      state.isAuthenticated = false;
      state.step = "email";
    });
  },
});

export const {
  setEmail,
  setOtp,
  setName,
  setHandle,
  setHandleStatus,
  setPrn,
  setDepartment,
  setBatch,
  setStep,
  setMessage,
  setDevOtp,
  setTokenDirect,
  logout,
} = authSlice.actions;

export default authSlice.reducer;
