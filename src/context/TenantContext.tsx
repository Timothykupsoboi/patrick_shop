/**
 * TenantContext — Provides supermarket_id and branch_id to all child components.
 *
 * All repository calls automatically scope data to the active tenant using this
 * context, ensuring strict data isolation between supermarkets.
 *
 * Platform Owner (supermarket_id = null) bypasses tenant scoping.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useAppSelector } from '../store';

export interface TenantContextValue {
  supermarketId: string | null;
  branchId: string | null;
  subscriptionStatus: string | null;
  isPlatformOwner: boolean;
}

const TenantContext = createContext<TenantContextValue>({
  supermarketId: null,
  branchId: null,
  subscriptionStatus: null,
  isPlatformOwner: false,
});

/**
 * Provider that reads the active session from Redux and exposes tenant info.
 * Must be placed inside <Provider store={store}>.
 */
export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const activeSupermarket = useAppSelector((state) => state.auth.activeSupermarket);

  const value = useMemo<TenantContextValue>(() => ({
    supermarketId: currentUser?.supermarket_id ?? null,
    branchId: currentUser?.branch_id ?? null,
    subscriptionStatus: activeSupermarket?.subscription_status ?? null,
    isPlatformOwner: currentUser?.role === 'platform_owner',
  }), [currentUser, activeSupermarket]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

/**
 * Hook to access tenant context in any component.
 */
export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}
