// import { NextRequest, NextResponse } from "next/server";
// import { SerialPort } from "serialport";
// import { ReadlineParser } from "@serialport/parser-readline";

// // Global state for the scale connection
// let globalScalePort: any = null;
// let globalScaleParser: any = null;
// let globalScaleData: any = null;
// let globalScaleConnected = false;
// let globalScaleReaders: any[] = [];
// let scaleInterval: NodeJS.Timeout | null = null;
// let currentWeight: number | null = null;




import { NextRequest, NextResponse } from "next/server";

// Keep your global state
let globalScalePort: any = null;
let globalScaleParser: any = null;
let globalScaleConnected = false;
let currentWeight: number | null = null;
let globalScaleReaders: any[] = [];  // ← ADD THIS
let scaleInterval: NodeJS.Timeout | null = null;  // ← ADD THIS

// Helper to load serialport when needed
async function getSerialPortModules() {
  const { SerialPort } = await import('serialport');
  const { ReadlineParser } = await import('@serialport/parser-readline');
  return { SerialPort, ReadlineParser };
}

// For WebSocket-like streaming (Server-Sent Events)
export async function GET(req: NextRequest) {
  try {
    // Check if we already have a connection
    if (globalScaleConnected && globalScalePort) {
      return NextResponse.json({
        connected: true,
        weight: currentWeight,
        message: "Scale already connected"
      });
    }

    return NextResponse.json({ 
      connected: false,
      weight: null,
      message: "Scale not connected. Use POST to connect."
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get scale status" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, portPath } = body;

    switch (action) {
      case 'connect':
        return await connectScale(portPath);
      
      case 'disconnect':
        return await disconnectScale();
      
      case 'tare':
        return await tareScale();
      
      case 'getWeight':
        return await getWeight();
      
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Scale API error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to process request" 
    }, { status: 500 });
  }
}

async function connectScale(portPath?: string) {
  try {

    const { SerialPort, ReadlineParser } = await getSerialPortModules();
    // If already connected, return
    if (globalScaleConnected && globalScalePort) {
      return NextResponse.json({
        success: true,
        connected: true,
        message: "Already connected to scale"
      });
    }

    // Find available ports
    const ports = await SerialPort.list();
    console.log("Available ports:", ports);

    // If no port path provided, try to auto-detect
    let selectedPort = portPath;
    if (!selectedPort) {
      // Look for common serial ports
      const commonPorts = ports.filter(p => 
        p.path.includes('COM') || 
        p.path.includes('ttyUSB') || 
        p.path.includes('ttyACM')
      );
      
      if (commonPorts.length === 0) {
        return NextResponse.json({
          success: false,
          error: "No serial ports found. Please connect your scale."
        }, { status: 404 });
      }
      
      selectedPort = commonPorts[0].path;
      console.log("Auto-detected port:", selectedPort);
    }

    // Create serial port connection
    const port = new SerialPort({
      path: selectedPort,
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      autoOpen: false
    });

    // Create parser
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    // Open port
    await new Promise((resolve, reject) => {
      port.open((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    console.log("Serial port opened successfully");

    // Store global references
    globalScalePort = port;
    globalScaleParser = parser;
    globalScaleConnected = true;
    globalScaleReaders = [];
    

    // Handle data
    parser.on('data', (data: string) => {
      const cleaned = data.replace(/\x00/g, '').replace(/[^\x20-\x7E]/g, '').trim();
      if (cleaned) {
        // Try to parse weight from data
        const weight = parseWeightFromData(cleaned);
        if (weight !== null) {
          currentWeight = weight;
          console.log("📊 Scale weight:", weight, "kg");
        }
      }
    });

    // Handle errors
    port.on('error', (err) => {
      console.error('Serial port error:', err);
      globalScaleConnected = false;
    });

    port.on('close', () => {
      console.log('Serial port closed');
      globalScaleConnected = false;
    });

    return NextResponse.json({
      success: true,
      connected: true,
      port: selectedPort,
      message: "Scale connected successfully"
    });

  } catch (error: any) {
    console.error("Connect error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to connect to scale"
    }, { status: 500 });
  }
}

async function disconnectScale() {
  try {
    if (scaleInterval) {
      clearInterval(scaleInterval);
      scaleInterval = null;
    }

    if (globalScalePort) {
      await new Promise((resolve) => {
        globalScalePort.close(() => {
          resolve(true);
        });
      });
      globalScalePort = null;
    }

    globalScaleParser = null;
    globalScaleConnected = false;
    globalScaleReaders = [];
    currentWeight = null;

    return NextResponse.json({
      success: true,
      connected: false,
      message: "Scale disconnected successfully"
    });

  } catch (error: any) {
    console.error("Disconnect error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to disconnect scale"
    }, { status: 500 });
  }
}

async function tareScale() {
  try {
    if (!globalScaleConnected || !globalScalePort) {
      return NextResponse.json({
        success: false,
        error: "Scale not connected"
      }, { status: 400 });
    }

    // Send tare command (if supported by your scale)
    // Some scales support this via serial commands
    // For now, just reset the current weight
    currentWeight = 0;

    return NextResponse.json({
      success: true,
      message: "Scale tared successfully",
      weight: 0
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to tare scale"
    }, { status: 500 });
  }
}

async function getWeight() {
  try {
    if (!globalScaleConnected) {
      return NextResponse.json({
        success: false,
        error: "Scale not connected"
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      weight: currentWeight,
      connected: true
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to get weight"
    }, { status: 500 });
  }
}

function parseWeightFromData(data: string): number | null {
  if (!data || data.length === 0) return null;

  // Try to find any number in the data
  const numberMatch = data.match(/(\d+\.?\d*)/g);
  
  if (numberMatch && numberMatch.length > 0) {
    // Try the last number (most likely the weight)
    for (let i = numberMatch.length - 1; i >= 0; i--) {
      const num = parseFloat(numberMatch[i]);
      if (!isNaN(num) && num >= 0 && num < 100) {
        return num;
      }
    }
    
    // Try the first number
    const firstNum = parseFloat(numberMatch[0]);
    if (!isNaN(firstNum) && firstNum >= 0 && firstNum < 100) {
      return firstNum;
    }
  }

  // Try with signed pattern
  const signedMatch = data.match(/[+-]?\d+\.?\d*/);
  if (signedMatch) {
    const num = parseFloat(signedMatch[0]);
    if (!isNaN(num) && num >= 0 && num < 100) {
      return num;
    }
  }

  return null;
}










// import { NextRequest, NextResponse } from "next/server";

// // For WebUSB (browser-based) - this is a placeholder for backend integration
// export async function GET(req: NextRequest) {
//   try {
//     // This endpoint can be used for:
//     // 1. Checking if scale is connected
//     // 2. Getting weight from scale via serial port
//     // 3. Scale calibration
    
//     return NextResponse.json({ 
//       status: "ready",
//       message: "Scale API is ready. Use WebUSB in browser for direct connection."
//     });
//   } catch (error) {
//     return NextResponse.json({ error: "Failed to read scale" }, { status: 500 });
//   }
// }

// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();
//     const { action } = body;
    
//     switch (action) {
//       case 'calibrate':
//         // Calibrate scale
//         return NextResponse.json({ status: "calibrated" });
      
//       case 'tare':
//         // Tare the scale
//         return NextResponse.json({ status: "tared" });
      
//       default:
//         return NextResponse.json({ error: "Invalid action" }, { status: 400 });
//     }
//   } catch (error) {
//     return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
//   }
// }