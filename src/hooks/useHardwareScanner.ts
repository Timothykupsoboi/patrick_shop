import { useEffect, useRef } from 'react';

interface UseHardwareScannerProps {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

/**
 * Hook to capture inputs from USB / Bluetooth hardware barcode scanners.
 * Relies on the keyboard emulation behavior of external barcode scanners.
 */
export function useHardwareScanner({ onScan, enabled = true }: UseHardwareScannerProps) {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);
  const scanThresholdMs = 40; // Scanners type digits extremely fast (<30ms)

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTime.current;
      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        // Carriage return: process scanner buffer if it has contents
        const finalBarcode = buffer.current.trim();
        if (finalBarcode.length > 2 && timeDiff < 100) {
          onScan(finalBarcode);
          e.preventDefault();
        }
        buffer.current = '';
        return;
      }

      // Check if typing speed is fast enough to be a scanner
      // First character is allowed to have a longer delay
      if (buffer.current.length > 0 && timeDiff > scanThresholdMs) {
        // Too slow: reset because it is manual user typing
        buffer.current = e.key;
      } else {
        buffer.current += e.key;
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [onScan, enabled]);
}
