import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthToken, Permission } from '@/types';

interface AuthState {
  // State
  user: User | null;
  token: AuthToken | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: Permission[];

  // Actions
  login: (user: User, token: AuthToken) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  refreshToken: (token: AuthToken) => void;
  setLoading: (loading: boolean) => void;
  hasPermission: (resource: string, action: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      permissions: [],

      // Actions
      login: (user: User, token: AuthToken) => {
        const permissions = user.permissions || [];
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          permissions,
        });
      },

      logout: () => {
        // Clear local storage
        localStorage.removeItem('frys_auth_token');

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          permissions: [],
        });
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = { ...currentUser, ...userData };
          const permissions = updatedUser.permissions || [];
          set({
            user: updatedUser,
            permissions,
          });
        }
      },

      refreshToken: (token: AuthToken) => {
        set({ token });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      hasPermission: (resource: string, action: string) => {
        const { permissions, user } = get();

        // Admin has all permissions
        if (user?.role === 'admin') {
          return true;
        }

        // Check specific permissions
        return permissions.some(
          (perm) =>
            perm.resource === resource &&
            (perm.action === action || perm.action === 'manage')
        );
      },

      hasRole: (role: string) => {
        const { user } = get();
        return user?.role === role;
      },
    }),
    {
      name: 'frys-auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        permissions: state.permissions,
      }),
    }
  )
);

// Selectors for common auth checks
export const useAuthSelectors = () => {
  const store = useAuthStore();

  return {
    isAdmin: store.hasRole('admin'),
    isManager: store.hasRole('manager'),
    isDeveloper: store.hasRole('developer'),
    isOperator: store.hasRole('operator'),
    isViewer: store.hasRole('viewer'),

    canCreateWorkflows: store.hasPermission('workflows', 'create'),
    canEditWorkflows: store.hasPermission('workflows', 'update'),
    canDeleteWorkflows: store.hasPermission('workflows', 'delete'),
    canViewWorkflows: store.hasPermission('workflows', 'read'),

    canManagePlugins: store.hasPermission('plugins', 'manage'),
    canViewSystem: store.hasPermission('system', 'read'),
    canManageSystem: store.hasPermission('system', 'manage'),

    canManageUsers: store.hasPermission('users', 'manage'),
    canViewUsers: store.hasPermission('users', 'read'),
  };
};
