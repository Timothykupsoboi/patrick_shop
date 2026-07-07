import { Platform } from 'react-native';

export const csvExporter = {
  /**
   * Generates a CSV file from headers and row values.
   * Downloads it in the browser/Electron, or outputs it to native share buffers.
   */
  export(filename: string, headers: string[], rows: any[][]): void {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(val => {
          // Normalize text containing commas or quotes
          const escapedText = String(val === null || val === undefined ? '' : val).replace(/"/g, '""');
          return `"${escapedText}"`;
        }).join(',')
      )
    ].join('\n');

    if (Platform.OS === 'web') {
      try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log(`CSV file ${filename} downloaded successfully.`);
        return;
      } catch (e) {
        console.error('Browser CSV download failed', e);
      }
    }

    // Native Android / iOS sharing output
    console.log(`--- NATIVE CSV EXPORT SIMULATOR [${filename}] ---\n`, csvContent);
    // In production, integrate with expo-sharing and expo-file-system
  }
};
