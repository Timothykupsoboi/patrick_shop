import { Platform } from 'react-native';

let NetInfo: any = null;
if (Platform.OS !== 'web') {
  try {
    NetInfo = require('@react-native-community/netinfo');
  } catch (e) {
    console.error('Failed to import NetInfo on native', e);
  }
}

export const networkMonitor = {
  /**
   * Returns current online status.
   */
  async isOnline(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
    if (NetInfo) {
      const state = await NetInfo.fetch();
      return !!state.isConnected && !!state.isInternetReachable;
    }
    return true;
  },

  /**
   * Subscribes to connection change events.
   * Returns an unsubscribe function.
   */
  subscribe(callback: (online: boolean) => void): () => void {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const handleOnline = () => callback(true);
        const handleOffline = () => callback(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      }
      return () => {};
    }

    if (NetInfo) {
      return NetInfo.addEventListener((state: any) => {
        const online = !!state.isConnected && state.isInternetReachable !== false;
        callback(online);
      });
    }

    return () => {};
  }
};
