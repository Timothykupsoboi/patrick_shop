/**
 * usePermission — React hook for RBAC permission checks.
 *
 * Usage:
 *   const canOverridePrice = usePermission('override_price');
 *   if (!canOverridePrice) return null;
 */
import { useAppSelector } from '../store';
import { PermissionAction, hasPermission } from './roles';

/**
 * Returns true if the currently authenticated user has the given permission.
 * Automatically reads the current user's role from Redux auth state.
 */
export function usePermission(action: PermissionAction): boolean {
  const role = useAppSelector((state) => state.auth.currentUser?.role);
  return hasPermission(role as any, action);
}

/**
 * Returns a function that checks any permission against the current user.
 * Useful for checking multiple permissions inside a single component without
 * calling usePermission multiple times.
 *
 * Usage:
 *   const can = usePermissions();
 *   const visible = can('override_price') || can('apply_discount');
 */
export function usePermissions(): (action: PermissionAction) => boolean {
  const role = useAppSelector((state) => state.auth.currentUser?.role);
  return (action: PermissionAction) => hasPermission(role as any, action);
}
