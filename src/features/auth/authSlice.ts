import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authService, UserProfile, ActiveSupermarket } from './authService';
import { setActiveSyncSupermarketId } from '../../api/sync/syncEngine';

// ---------------------------------------------------------------------------
// State Type
// ---------------------------------------------------------------------------

export interface AuthState {
  currentUser: UserProfile | null;
  activeSupermarket: ActiveSupermarket | null;
  isAuthenticated: boolean;
  pinLocked: boolean;        // True when terminal needs PIN re-auth (shift lock)
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  currentUser: null,
  activeSupermarket: null,
  isAuthenticated: false,
  pinLocked: true,
  loading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Async Thunks
// ---------------------------------------------------------------------------

export const checkCachedSession = createAsyncThunk(
  'auth/checkCachedSession',
  async (_, thunkAPI) => {
    try {
      const user = await authService.getCachedSession();
      if (!user) return null;
      const supermarket = await authService.getActiveSupermarket(user.supermarket_id);
      return { user, supermarket };
    } catch (e: any) {
      return thunkAPI.rejectWithValue(e.message);
    }
  }
);

export const loginWithEmail = createAsyncThunk(
  'auth/loginWithEmail',
  async (credentials: { email: string; password: string }, thunkAPI) => {
    try {
      const user = await authService.loginWithEmail(credentials.email, credentials.password);
      const supermarket = await authService.getActiveSupermarket(user.supermarket_id);
      return { user, supermarket };
    } catch (e: any) {
      return thunkAPI.rejectWithValue(e.message);
    }
  }
);

export const loginWithPIN = createAsyncThunk(
  'auth/loginWithPIN',
  async (payload: { pin: string; supermarketId?: string }, thunkAPI) => {
    try {
      const user = await authService.loginWithPIN(payload.pin, payload.supermarketId);
      const supermarket = await authService.getActiveSupermarket(user.supermarket_id);
      return { user, supermarket };
    } catch (e: any) {
      return thunkAPI.rejectWithValue(e.message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, thunkAPI) => {
    try {
      await authService.logout();
      return null;
    } catch (e: any) {
      return thunkAPI.rejectWithValue(e.message);
    }
  }
);

// ---------------------------------------------------------------------------
// Payload type shared by login thunks
// ---------------------------------------------------------------------------

interface LoginResult {
  user: UserProfile;
  supermarket: ActiveSupermarket | null;
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    lockTerminal(state) {
      state.pinLocked = true;
    },
    unlockTerminal(state) {
      state.pinLocked = false;
    },
    clearAuthError(state) {
      state.error = null;
    },
    updateSupermarketStatus(state, action: PayloadAction<ActiveSupermarket['subscription_status']>) {
      if (state.activeSupermarket) {
        state.activeSupermarket.subscription_status = action.payload;
      }
    }
  },
  extraReducers: (builder) => {
    builder

      // ── checkCachedSession ──────────────────────────────────────────────
      .addCase(checkCachedSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkCachedSession.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.currentUser = action.payload.user;
          state.activeSupermarket = action.payload.supermarket;
          state.isAuthenticated = true;
          state.pinLocked = false;
          // Scope sync to this supermarket
          setActiveSyncSupermarketId(action.payload.user.supermarket_id);
        } else {
          state.currentUser = null;
          state.activeSupermarket = null;
          state.isAuthenticated = false;
          state.pinLocked = true;
          setActiveSyncSupermarketId(null);
        }
      })
      .addCase(checkCachedSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // ── loginWithEmail ──────────────────────────────────────────────────
      .addCase(loginWithEmail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithEmail.fulfilled, (state, action: PayloadAction<LoginResult>) => {
        state.loading = false;
        state.currentUser = action.payload.user;
        state.activeSupermarket = action.payload.supermarket;
        state.isAuthenticated = true;
        state.pinLocked = false;
        setActiveSyncSupermarketId(action.payload.user.supermarket_id);
      })
      .addCase(loginWithEmail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // ── loginWithPIN ────────────────────────────────────────────────────
      .addCase(loginWithPIN.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithPIN.fulfilled, (state, action: PayloadAction<LoginResult>) => {
        state.loading = false;
        state.currentUser = action.payload.user;
        state.activeSupermarket = action.payload.supermarket;
        state.isAuthenticated = true;
        state.pinLocked = false;
        setActiveSyncSupermarketId(action.payload.user.supermarket_id);
      })
      .addCase(loginWithPIN.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // ── logoutUser ──────────────────────────────────────────────────────
      .addCase(logoutUser.fulfilled, (state) => {
        state.currentUser = null;
        state.activeSupermarket = null;
        state.isAuthenticated = false;
        state.pinLocked = true;
        state.error = null;
        setActiveSyncSupermarketId(null);
      });
  }
});

export const {
  lockTerminal,
  unlockTerminal,
  clearAuthError,
  updateSupermarketStatus,
} = authSlice.actions;

export default authSlice.reducer;
