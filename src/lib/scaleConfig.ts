// src/lib/scaleConfig.ts
export const SCALE_CONFIG = {
  vendorIds: {
    // Add your scale's vendor ID here
    YOUR_SCALE: 0x1234,
    COMMON_1: 0x0b05,
    COMMON_2: 0x04b8,
    COMMON_3: 0x05ac,
    // Common scale vendor IDs
    Mettler: 0x0640,
    Ohaus: 0x0b67,
    Adam: 0x0b6a,
  },
  
  productIds: {
    // Add your scale's product ID if known
    YOUR_SCALE: 0x5678,
  },
  
  // Baud rate for serial communication
  baudRate: 9600,
  
  // Data format
  dataFormat: 'ascii',
  
  // Weight units
  unit: 'kg',
  
  // Auto-add settings
  autoAddToCart: true,
  stableThreshold: 0.01,
  
  // Time to wait for stable weight (ms)
  stabilityWaitTime: 500,
};