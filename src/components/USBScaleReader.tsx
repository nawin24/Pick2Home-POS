"use client";
import { useState, useEffect, useRef } from 'react';
import { USBScaleReaderProps } from '@/types/scale';

// Global singleton for scale connection
let globalPort: any = null;
let globalReader: any = null;
let globalIsReading = false;
let globalDataCallbacks: ((data: string) => void)[] = [];
let globalIsConnected = false;
let globalConnectPromise: Promise<void> | null = null;

interface ExtendedUSBScaleReaderProps extends USBScaleReaderProps {
  persistentConnection?: boolean;
}

export default function USBScaleReader({ 
  onWeightRead, 
  onWeightStable, 
  productName,
  autoAdd = true,
  onClose,
  persistentConnection = false
}: ExtendedUSBScaleReaderProps) {
  const [weight, setWeight] = useState<number | null>(null);
  const [isStable, setIsStable] = useState(false);
  const [isConnected, setIsConnected] = useState(globalIsConnected);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scaleData, setScaleData] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  const [parsedWeights, setParsedWeights] = useState<number[]>([]);
  const [tareWeight, setTareWeight] = useState<number>(0);
  const [allDataHistory, setAllDataHistory] = useState<string[]>([]);
  const [manualWeightInput, setManualWeightInput] = useState<string>('');
  const [useManualParser, setUseManualParser] = useState(false);
  const [isLiveReading, setIsLiveReading] = useState(false);
  const [stableCount, setStableCount] = useState(0);
  const [readTime, setReadTime] = useState<string>('');
  const [lastReadValue, setLastReadValue] = useState<number | null>(null);
  const [readingsPerSecond, setReadingsPerSecond] = useState(0);
  const [stabilityProgress, setStabilityProgress] = useState(0);
  const [addTimeout, setAddTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Local refs
  const stableWeightRef = useRef<number | null>(null);
  const weightHistoryRef = useRef<number[]>([]);
  const dataBufferRef = useRef<string>('');
  const readCountRef = useRef<number>(0);
  const lastReadTimeRef = useRef<number>(Date.now());
  const addTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const componentIdRef = useRef<string>(Math.random().toString(36).substring(7));

  const isSerialAvailable = (): boolean => {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  };

  // Register callback for data
  useEffect(() => {
    isMountedRef.current = true;
    const callbackId = componentIdRef.current;
    
    // Add callback to global list
    const dataCallback = (data: string) => {
      if (isMountedRef.current) {
        processDataLine(data);
      }
    };
    globalDataCallbacks.push(dataCallback);
    
    // Check if already connected
    if (globalIsConnected && globalPort) {
      setIsConnected(true);
      setDeviceInfo('✅ Using existing connection');
    }
    
    // Auto-connect if persistent and not connected
    if (persistentConnection && !globalIsConnected && !globalConnectPromise) {
      connectToScale();
    }
    
    return () => {
      isMountedRef.current = false;
      // Remove callback
      const index = globalDataCallbacks.indexOf(dataCallback);
      if (index > -1) {
        globalDataCallbacks.splice(index, 1);
      }
      // Clean up timeout
      if (addTimeoutRef.current) {
        clearTimeout(addTimeoutRef.current);
        addTimeoutRef.current = null;
      }
    };
  }, []);

  const connectToScale = async () => {
    // If already connecting or connected, wait
    if (globalConnectPromise) {
      await globalConnectPromise;
      return;
    }
    
    if (globalIsConnected && globalPort) {
      console.log('Scale already connected globally');
      setIsConnected(true);
      return;
    }

    globalConnectPromise = (async () => {
      try {
        setIsReading(true);
        setError(null);

        if (!isSerialAvailable()) {
          setError("Web Serial API not supported. Please use Chrome or Edge.");
          setIsReading(false);
          globalConnectPromise = null;
          return;
        }

        let port;
        try {
          const existingPorts = await (navigator as any).serial.getPorts();
          if (existingPorts && existingPorts.length > 0) {
            port = existingPorts[0];
            console.log('Using existing port:', port);
          } else {
            port = await (navigator as any).serial.requestPort();
          }
        } catch (err) {
          console.log("Port selection error:", err);
          setError("No port selected. Please select your serial port.");
          setIsReading(false);
          globalConnectPromise = null;
          return;
        }

        if (!port) {
          setError("No port selected.");
          setIsReading(false);
          globalConnectPromise = null;
          return;
        }

        // Store port globally
        globalPort = port;

        // Check if already open
        if (port.connected) {
          console.log("Port already connected");
          if (port.readable) {
            globalIsConnected = true;
            globalIsReading = true;
            setIsConnected(true);
            setDeviceInfo('✅ Connected to Vein Scale');
            setError(null);
            startGlobalReading(port);
            globalConnectPromise = null;
            return;
          }
        }

        // Open port
        await port.open({ 
          baudRate: 9600,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          flowControl: 'none'
        });
        console.log("Port opened successfully");

        if (!port.readable) {
          setError("Port opened but no readable stream");
          setIsReading(false);
          globalConnectPromise = null;
          return;
        }

        globalIsConnected = true;
        globalIsReading = true;
        setIsConnected(true);
        setDeviceInfo('✅ Connected to Vein Scale');
        setError(null);
        setIsLiveReading(true);

        startGlobalReading(port);

      } catch (err: any) {
        console.error("Connection error:", err);
        if (err.message?.includes('already open') && globalPort) {
          globalIsConnected = true;
          setIsConnected(true);
          setError(null);
          if (globalPort.readable) {
            startGlobalReading(globalPort);
          }
        } else {
          setError("Failed to connect: " + (err.message || "Unknown error"));
          setIsReading(false);
        }
      } finally {
        globalConnectPromise = null;
      }
    })();

    await globalConnectPromise;
  };

  const startGlobalReading = (port: any) => {
    if (globalReader) {
      try {
        globalReader.cancel();
        globalReader.releaseLock();
      } catch (e) {}
      globalReader = null;
    }

    if (!port.readable) {
      console.error('Port has no readable stream');
      return;
    }

    if (port.readable.locked) {
      console.log('Stream locked, attempting to unlock...');
      try {
        const tempReader = port.readable.getReader();
        tempReader.cancel();
        tempReader.releaseLock();
      } catch (e) {}
    }

    try {
      const reader = port.readable.getReader();
      globalReader = reader;
      
      // Start reading loop
      (async () => {
        try {
          while (globalIsReading && globalIsConnected) {
            try {
              const { value, done } = await reader.read();
              if (done) {
                console.log("Stream ended, reconnecting...");
                // Try to get a new reader
                if (globalPort && globalPort.readable && !globalPort.readable.locked) {
                  try {
                    const newReader = globalPort.readable.getReader();
                    if (newReader) {
                      globalReader = newReader;
                      continue;
                    }
                  } catch (e) {}
                }
                break;
              }
              
              const text = new TextDecoder('ascii').decode(value);
              // Send to all registered callbacks
              for (const callback of globalDataCallbacks) {
                try {
                  callback(text);
                } catch (e) {}
              }
              
            } catch (readErr) {
              console.log("Read error:", readErr);
              if (readErr instanceof Error && readErr.name === 'FramingError') {
                continue;
              }
              break;
            }
          }
        } catch (err) {
          console.error("Global reading error:", err);
          globalIsConnected = false;
          globalIsReading = false;
        }
      })();
      
    } catch (err) {
      console.error('Failed to start global reading:', err);
      globalIsConnected = false;
      globalIsReading = false;
    }
  };

  const processDataLine = (data: string) => {
    if (!isMountedRef.current) return;
    
    const cleaned = data.replace(/\x00/g, '').replace(/[^\x20-\x7E]/g, '').trim();
    
    if (!cleaned || cleaned.length === 0) return;

    dataBufferRef.current += cleaned;

    if (dataBufferRef.current.includes('\n') || dataBufferRef.current.includes('\r') || dataBufferRef.current.length > 20) {
      const parts = dataBufferRef.current.split(/[\n\r]+/);
      dataBufferRef.current = parts.pop() || '';

      for (const part of parts) {
        if (part.trim()) {
          processSingleLine(part.trim());
        }
      }
    }

    if (dataBufferRef.current.length > 50) {
      processSingleLine(dataBufferRef.current);
      dataBufferRef.current = '';
    }
  };

  const processSingleLine = (data: string) => {
    if (!isMountedRef.current) return;
    
    setScaleData(data);
    
    const now = Date.now();
    setReadTime(new Date().toLocaleTimeString());
    
    readCountRef.current++;
    if (now - lastReadTimeRef.current >= 1000) {
      setReadingsPerSecond(readCountRef.current);
      readCountRef.current = 0;
      lastReadTimeRef.current = now;
    }
    
    setAllDataHistory(prev => {
      const newHistory = [...prev, data];
      if (newHistory.length > 20) newHistory.shift();
      return newHistory;
    });

    let weightValue: number | null = null;

    if (useManualParser && manualWeightInput) {
      const num = parseFloat(manualWeightInput);
      if (!isNaN(num) && num >= 0) {
        weightValue = num;
      }
    } else {
      weightValue = parseWeightFromData(data);
    }

    if (weightValue !== null && weightValue >= 0) {
      const actualWeight = Math.max(0, weightValue - tareWeight);
      
      setLastReadValue(actualWeight);
      setWeight(actualWeight);
      onWeightRead(actualWeight);

      setParsedWeights(prev => {
        const newWeights = [...prev, actualWeight];
        if (newWeights.length > 10) newWeights.shift();
        return newWeights;
      });

      weightHistoryRef.current.push(actualWeight);
      if (weightHistoryRef.current.length > 10) {
        weightHistoryRef.current.shift();
      }

      if (addTimeoutRef.current) {
        clearTimeout(addTimeoutRef.current);
        addTimeoutRef.current = null;
      }

      const stable = checkWeightStability(weightHistoryRef.current);
      setIsStable(stable);
      
      if (weightHistoryRef.current.length >= 5) {
        setStabilityProgress(100);
      } else {
        setStabilityProgress(Math.round((weightHistoryRef.current.length / 5) * 100));
      }
      
      setStableCount(weightHistoryRef.current.length);

      if ((stable || weightHistoryRef.current.length >= 3) && !isConfirming && actualWeight > 0.01) {
        console.log(`✅ Weight stable: ${actualWeight} kg`);
        setIsConfirming(true);
        stableWeightRef.current = actualWeight;

        if (onWeightStable) {
          onWeightStable(actualWeight);
        }
        
        if (autoAdd && onWeightRead) {
          onWeightRead(actualWeight);
        }
        
        setTimeout(() => {
          if (onClose) {
            onClose();
          }
        }, 500);
      }
      
      if (!addTimeoutRef.current && actualWeight > 0.01 && !isConfirming) {
        addTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && !isConfirming && actualWeight > 0.01) {
            setIsConfirming(true);
            stableWeightRef.current = actualWeight;

            if (onWeightStable) {
              onWeightStable(actualWeight);
            }
            
            if (autoAdd && onWeightRead) {
              onWeightRead(actualWeight);
            }
            
            setTimeout(() => {
              if (onClose) {
                onClose();
              }
            }, 500);
          }
          addTimeoutRef.current = null;
        }, 3000);
      }
    }
  };

  const parseWeightFromData = (data: string): number | null => {
    if (!data || data.length === 0) return null;

    const numberMatch = data.match(/(\d+\.?\d*)/g);
    
    if (numberMatch && numberMatch.length > 0) {
      for (let i = numberMatch.length - 1; i >= 0; i--) {
        const num = parseFloat(numberMatch[i]);
        if (!isNaN(num) && num >= 0 && num < 100) {
          return num;
        }
      }
      
      const firstNum = parseFloat(numberMatch[0]);
      if (!isNaN(firstNum) && firstNum >= 0 && firstNum < 100) {
        return firstNum;
      }
    }

    const signedMatch = data.match(/[+-]?\d+\.?\d*/);
    if (signedMatch) {
      const num = parseFloat(signedMatch[0]);
      if (!isNaN(num) && num >= 0 && num < 100) {
        return num;
      }
    }

    return null;
  };

  const checkWeightStability = (weights: number[]): boolean => {
    if (weights.length < 5) return false;
    
    const recent = weights.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / recent.length;
    
    return variance < 0.01;
  };

  const tareScale = () => {
    if (weight !== null) {
      setTareWeight(weight);
      setWeight(0);
      weightHistoryRef.current = [];
      setParsedWeights([]);
      setStableCount(0);
      setStabilityProgress(0);
      setDeviceInfo(`Tared at ${weight.toFixed(3)} kg`);
    } else {
      alert("Please wait for a reading before taring.");
    }
  };

  const disconnect = () => {
    if (addTimeoutRef.current) {
      clearTimeout(addTimeoutRef.current);
      addTimeoutRef.current = null;
    }
    
    if (onClose) {
      onClose();
    }
  };

  const showManualEntryPrompt = () => {
    const manualWeight = prompt(`Enter weight for ${productName || 'item'} (in kg):`, "0.5");
    if (manualWeight) {
      const weight = parseFloat(manualWeight);
      if (weight > 0) {
        setWeight(weight);
        onWeightStable?.(weight);
        if (autoAdd && onWeightRead) {
          onWeightRead(weight);
        }
      }
    }
  };

  const applyManualParser = () => {
    const num = parseFloat(manualWeightInput);
    if (!isNaN(num) && num >= 0) {
      setUseManualParser(true);
      setWeight(num);
      onWeightRead(num);
      setDeviceInfo(`Manual weight: ${num} kg`);
    } else {
      alert("Please enter a valid weight");
    }
  };

  return (
    <div className="scale-reader p-4 border rounded-lg bg-white shadow-sm">
      <div className="text-center">
        {!isSerialAvailable() && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
            ⚠️ Web Serial API not supported. Please use Chrome or Edge.
          </div>
        )}

        <div className="text-sm text-slate-500 mb-2">
          {productName ? (
            <span>Weighing: <span className="font-medium text-slate-700">{productName}</span></span>
          ) : (
            'Place item on scale'
          )}
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className={`badge ${globalIsConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {globalIsConnected ? '🔗 Connected' : '⚪ Disconnected'}
            </span>
            {globalIsReading && (
              <span className="badge bg-green-100 text-green-700 animate-pulse">
                📡 Live ({readingsPerSecond}/s)
              </span>
            )}
            {isConnected && (
              <span className={`badge ${isStable ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {isStable ? '✅ Stable' : `⏳ ${stableCount}/5 readings`}
              </span>
            )}
          </div>
          
          {deviceInfo && (
            <div className="text-xs text-slate-500 bg-slate-50 p-1 rounded">
              {deviceInfo}
            </div>
          )}
        </div>
        
        <div className="text-5xl font-bold text-brand-600 my-4 font-mono">
          {weight !== null ? `${weight.toFixed(3)}` : '0.000'}
          <span className="text-2xl text-slate-400 ml-1">kg</span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
          <div className="bg-slate-50 p-2 rounded">
            <div className="text-slate-400">Stability</div>
            <div className="font-semibold text-slate-700">{stabilityProgress}%</div>
          </div>
          <div className="bg-slate-50 p-2 rounded">
            <div className="text-slate-400">Readings</div>
            <div className="font-semibold text-slate-700">{parsedWeights.length}</div>
          </div>
          <div className="bg-slate-50 p-2 rounded">
            <div className="text-slate-400">Status</div>
            <div className="font-semibold text-emerald-700">{isConfirming ? '✅ Added' : globalIsConnected ? '🟢 Ready' : '⚪ Off'}</div>
          </div>
        </div>

        <div className="w-full bg-slate-200 rounded-full h-1.5 mb-3">
          <div 
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${stabilityProgress}%` }}
          />
        </div>

        <div className="bg-slate-800 rounded-lg p-3 mb-3 text-left">
          <div className="text-xs font-bold text-white mb-2">🔍 LIVE SERIAL DATA</div>
          
          <div className="text-xs font-mono text-green-400 break-all bg-slate-900 p-1 rounded mb-1">
            <span className="text-slate-400">Data:</span> {scaleData || 'Waiting...'}
          </div>
          
          <div className="text-[10px] text-emerald-400 mt-1">
            Last parsed: {lastReadValue !== null ? `${lastReadValue.toFixed(3)} kg` : 'None'}
          </div>
          
          {allDataHistory.length > 0 && (
            <div className="text-[10px] font-mono text-slate-300 bg-slate-900 p-1 rounded max-h-16 overflow-y-auto mt-1">
              {allDataHistory.slice(-5).map((d, i) => (
                <div key={i}>[{allDataHistory.length - 5 + i + 1}] {d}</div>
              ))}
            </div>
          )}
          
          {parsedWeights.length > 0 && (
            <div className="text-[10px] text-emerald-400 mt-1">
              → {parsedWeights.slice(-5).map(w => w.toFixed(3)).join(' → ')}
            </div>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
          <div className="text-xs font-medium text-amber-700 mb-1">Manual Test</div>
          <div className="flex gap-2">
            <input
              type="number"
              className="input py-1 text-sm flex-1"
              placeholder="Enter weight (e.g., 1.5)"
              value={manualWeightInput}
              onChange={(e) => setManualWeightInput(e.target.value)}
              step="0.001"
            />
            <button 
              onClick={applyManualParser} 
              className="btn btn-sm bg-amber-600 text-white hover:bg-amber-700 px-3 py-1"
            >
              Set
            </button>
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-2 rounded mb-3">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-center flex-wrap">
          {!isInitialized ? (
            <>
              <button 
                onClick={() => {
                  setIsInitialized(true);
                  connectToScale();
                }} 
                className="btn btn-primary flex items-center gap-2"
                disabled={!isSerialAvailable() || globalIsConnected}
              >
                <span>🔌</span> {globalIsConnected ? '✅ Connected' : 'Connect Scale'}
              </button>
              <button 
                onClick={showManualEntryPrompt} 
                className="btn btn-secondary flex items-center gap-2"
              >
                <span>✏️</span> Manual Entry
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={disconnect} 
                className="btn btn-secondary flex items-center gap-2"
              >
                <span>⏹️</span> Cancel
              </button>
              <button 
                onClick={tareScale} 
                className="btn btn-warning flex items-center gap-2"
                disabled={weight === null}
              >
                <span>⚖️</span> Tare
              </button>
              {globalIsConnected && weight !== null && weight > 0 && (
                <button 
                  onClick={() => {
                    if (weight > 0) {
                      onWeightStable?.(weight);
                      if (autoAdd && onWeightRead) {
                        onWeightRead(weight);
                      }
                      setTimeout(() => {
                        if (onClose) {
                          onClose();
                        }
                      }, 300);
                    }
                  }} 
                  className="btn btn-primary flex items-center gap-2"
                >
                  <span>✅</span> Add {weight.toFixed(2)}kg
                </button>
              )}
            </>
          )}
        </div>

        <div className="mt-3 text-xs text-slate-400">
          {!isInitialized ? (
            'Click "Connect Scale" to connect your Vein Scale'
          ) : globalIsConnected ? (
            isStable && weight && weight > 0 ? 
              '✅ Weight stable. Auto-adding...' : 
              weight === 0 ? 
                '⚖️ Place item on scale...' : 
                `⏳ Waiting for stable reading... (${stableCount}/5) - Auto-add in 3s`
          ) : (
            '⏳ Connecting...'
          )}
        </div>
        
        <div className="mt-2 text-[10px] text-slate-400">
          💡 Auto-adds after 3 seconds even if not stable
        </div>
      </div>
    </div>
  );
}


// "use client";
// import { useState, useEffect, useRef } from 'react';
// import { USBScaleReaderProps } from '@/types/scale';

// export default function USBScaleReader({ 
//   onWeightRead, 
//   onWeightStable, 
//   productName,
//   autoAdd = true,
//   onClose 
// }: USBScaleReaderProps) {
//   const [weight, setWeight] = useState<number | null>(null);
//   const [isStable, setIsStable] = useState(false);
//   const [isConnected, setIsConnected] = useState(false);
//   const [isReading, setIsReading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [scaleData, setScaleData] = useState<string>('');
//   const [isConfirming, setIsConfirming] = useState(false);
//   const [deviceInfo, setDeviceInfo] = useState<string>('');
//   const [parsedWeights, setParsedWeights] = useState<number[]>([]);
//   const [tareWeight, setTareWeight] = useState<number>(0);
//   const [allDataHistory, setAllDataHistory] = useState<string[]>([]);
//   const [manualWeightInput, setManualWeightInput] = useState<string>('');
//   const [useManualParser, setUseManualParser] = useState(false);
//   const [isLiveReading, setIsLiveReading] = useState(false);
//   const [stableCount, setStableCount] = useState(0);
//   const [readTime, setReadTime] = useState<string>('');
//   const [lastReadValue, setLastReadValue] = useState<number | null>(null);
//   const [readingsPerSecond, setReadingsPerSecond] = useState(0);
//   const [stabilityProgress, setStabilityProgress] = useState(0);
//   const [addTimeout, setAddTimeout] = useState<NodeJS.Timeout | null>(null);
  
//   const readerRef = useRef<any>(null);
//   const portRef = useRef<any>(null);
//   const stableWeightRef = useRef<number | null>(null);
//   const weightHistoryRef = useRef<number[]>([]);
//   const readingLoopRef = useRef<boolean>(false);
//   const dataBufferRef = useRef<string>('');
//   const lastWeightRef = useRef<number | null>(null);
//   const stableCountRef = useRef<number>(0);
//   const readCountRef = useRef<number>(0);
//   const lastReadTimeRef = useRef<number>(Date.now());
//   const isClosingRef = useRef<boolean>(false);

//   const isSerialAvailable = (): boolean => {
//     return typeof navigator !== 'undefined' && 'serial' in navigator;
//   };

//   const connectToScale = async () => {
//     try {
//       setIsReading(true);
//       setError(null);
//       setAllDataHistory([]);
//       dataBufferRef.current = '';
//       stableCountRef.current = 0;
//       setStableCount(0);
//       setStabilityProgress(0);
//       setReadingsPerSecond(0);
//       setIsLiveReading(false);
//       readCountRef.current = 0;
//       lastReadTimeRef.current = Date.now();
//       isClosingRef.current = false;

//       if (!isSerialAvailable()) {
//         setError("Web Serial API not supported. Please use Chrome or Edge.");
//         setIsReading(false);
//         return;
//       }

//       let port;
//       try {
//         port = await (navigator as any).serial.requestPort();
//       } catch (err) {
//         console.log("User cancelled port selection");
//         setError("No port selected. Please select your serial port.");
//         setIsReading(false);
//         return;
//       }

//       if (!port) {
//         setError("No port selected.");
//         setIsReading(false);
//         return;
//       }

//       console.log("Selected port:", port);
//       portRef.current = port;

//       await port.open({ 
//         baudRate: 9600,
//         dataBits: 8,
//         stopBits: 1,
//         parity: 'none',
//         flowControl: 'none'
//       });
//       console.log("Port opened successfully");

//       setDeviceInfo(`✅ Connected to Vein Scale`);
//       setIsConnected(true);
//       setError(null);
//       setIsLiveReading(true);

//       startReading(port);

//     } catch (err: any) {
//       console.error("Connection error:", err);
//       setError("Failed to connect: " + (err.message || "Unknown error"));
//       setIsReading(false);
//     }
//   };

//   const startReading = async (port: any) => {
//     readingLoopRef.current = true;

//     try {
//       const reader = port.readable?.getReader();
//       if (!reader) {
//         setError("Could not get reader from port");
//         setIsConnected(false);
//         setIsReading(false);
//         return;
//       }

//       readerRef.current = reader;

//       while (readingLoopRef.current) {
//         try {
//           const { value, done } = await reader.read();
//           if (done) {
//             console.log("Read stream ended, reconnecting...");
//             break;
//           }

//           const text = new TextDecoder('ascii').decode(value);
//           processSerialData(text);
          
//         } catch (readErr) {
//           console.log("Read error:", readErr);
//           if (readErr instanceof Error && readErr.name === 'FramingError') {
//             console.log("Framing error, continuing...");
//             continue;
//           }
//           break;
//         }
//       }
//     } catch (err) {
//       console.error("Reading error:", err);
//       setIsConnected(false);
//       setIsReading(false);
//     }
//   };

//   const processSerialData = (text: string) => {
//     const cleaned = text.replace(/\x00/g, '').replace(/[^\x20-\x7E]/g, '').trim();
    
//     if (!cleaned || cleaned.length === 0) return;

//     dataBufferRef.current += cleaned;

//     if (dataBufferRef.current.includes('\n') || dataBufferRef.current.includes('\r') || dataBufferRef.current.length > 20) {
//       const parts = dataBufferRef.current.split(/[\n\r]+/);
//       dataBufferRef.current = parts.pop() || '';

//       for (const part of parts) {
//         if (part.trim()) {
//           processDataLine(part.trim());
//         }
//       }
//     }

//     if (dataBufferRef.current.length > 50) {
//       processDataLine(dataBufferRef.current);
//       dataBufferRef.current = '';
//     }
//   };

//   const processDataLine = (data: string) => {
//     setScaleData(data);
    
//     const now = Date.now();
//     setReadTime(new Date().toLocaleTimeString());
    
//     readCountRef.current++;
//     if (now - lastReadTimeRef.current >= 1000) {
//       setReadingsPerSecond(readCountRef.current);
//       readCountRef.current = 0;
//       lastReadTimeRef.current = now;
//     }
    
//     setAllDataHistory(prev => {
//       const newHistory = [...prev, data];
//       if (newHistory.length > 20) newHistory.shift();
//       return newHistory;
//     });

//     console.log("📊 Serial line:", data);

//     let weightValue: number | null = null;

//     if (useManualParser && manualWeightInput) {
//       const num = parseFloat(manualWeightInput);
//       if (!isNaN(num) && num >= 0) {
//         weightValue = num;
//       }
//     } else {
//       weightValue = parseWeightFromData(data);
//     }

//     if (weightValue !== null && weightValue >= 0) {
//       const actualWeight = Math.max(0, weightValue - tareWeight);
      
//       setLastReadValue(actualWeight);
//       setWeight(actualWeight);
//       onWeightRead(actualWeight);

//       setParsedWeights(prev => {
//         const newWeights = [...prev, actualWeight];
//         if (newWeights.length > 10) newWeights.shift();
//         return newWeights;
//       });

//       weightHistoryRef.current.push(actualWeight);
//       if (weightHistoryRef.current.length > 10) {
//         weightHistoryRef.current.shift();
//       }

//       // Clear any existing timeout
//       if (addTimeout) {
//         clearTimeout(addTimeout);
//         setAddTimeout(null);
//       }

//       const stable = checkWeightStability(weightHistoryRef.current);
//       setIsStable(stable);
      
//       if (weightHistoryRef.current.length >= 5) {
//         setStabilityProgress(100);
//       } else {
//         setStabilityProgress(Math.round((weightHistoryRef.current.length / 5) * 100));
//       }
      
//       setStableCount(weightHistoryRef.current.length);

//       // Auto-add when stable OR after 3 readings (quick add)
//       if ((stable || weightHistoryRef.current.length >= 3) && !isConfirming && actualWeight > 0.01) {
//         console.log(`✅ Weight stable or 3+ readings: ${actualWeight} kg`);
//         setIsConfirming(true);
//         stableWeightRef.current = actualWeight;

//         if (onWeightStable) {
//           console.log(`📤 Calling onWeightStable with: ${actualWeight} kg`);
//           onWeightStable(actualWeight);
//         }
        
//         if (autoAdd && onWeightRead) {
//           console.log(`📤 Calling onWeightRead with: ${actualWeight} kg`);
//           onWeightRead(actualWeight);
//         }
        
//         setTimeout(() => {
//           if (onClose) {
//             onClose();
//           }
//         }, 500);
//       }
      
//       // FORCE ADD after 3 seconds even if not stable
//       if (!addTimeout && actualWeight > 0.01 && !isConfirming) {
//         console.log(`⏰ Setting 3-second force add timer for ${actualWeight} kg`);
//         const timeout = setTimeout(() => {
//           console.log(`⏰ FORCE ADD after 3 seconds: ${actualWeight} kg`);
//           if (!isConfirming && actualWeight > 0.01) {
//             setIsConfirming(true);
//             stableWeightRef.current = actualWeight;

//             if (onWeightStable) {
//               onWeightStable(actualWeight);
//             }
            
//             if (autoAdd && onWeightRead) {
//               onWeightRead(actualWeight);
//             }
            
//             setTimeout(() => {
//               if (onClose) {
//                 onClose();
//               }
//             }, 500);
//           }
//           setAddTimeout(null);
//         }, 3000); // 3 seconds
        
//         setAddTimeout(timeout);
//       }
//     }
//   };

//   const parseWeightFromData = (data: string): number | null => {
//     if (!data || data.length === 0) return null;

//     const numberMatch = data.match(/(\d+\.?\d*)/g);
    
//     if (numberMatch && numberMatch.length > 0) {
//       for (let i = numberMatch.length - 1; i >= 0; i--) {
//         const num = parseFloat(numberMatch[i]);
//         if (!isNaN(num) && num >= 0 && num < 100) {
//           console.log(`✅ Found weight: ${num} kg`);
//           return num;
//         }
//       }
      
//       const firstNum = parseFloat(numberMatch[0]);
//       if (!isNaN(firstNum) && firstNum >= 0 && firstNum < 100) {
//         console.log(`✅ Found weight (first): ${firstNum} kg`);
//         return firstNum;
//       }
//     }

//     const signedMatch = data.match(/[+-]?\d+\.?\d*/);
//     if (signedMatch) {
//       const num = parseFloat(signedMatch[0]);
//       if (!isNaN(num) && num >= 0 && num < 100) {
//         console.log(`✅ Found signed weight: ${num} kg`);
//         return num;
//       }
//     }

//     return null;
//   };

//   const checkWeightStability = (weights: number[]): boolean => {
//     if (weights.length < 5) return false;
    
//     const recent = weights.slice(-5);
//     const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
//     const variance = recent.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / recent.length;
    
//     return variance < 0.01;
//   };

//   const tareScale = () => {
//     if (weight !== null) {
//       setTareWeight(weight);
//       setWeight(0);
//       weightHistoryRef.current = [];
//       setParsedWeights([]);
//       stableCountRef.current = 0;
//       setStableCount(0);
//       setStabilityProgress(0);
//       console.log(`⚖️ Tared: ${weight} kg`);
//       setDeviceInfo(`Tared at ${weight.toFixed(3)} kg`);
//     } else {
//       alert("Please wait for a reading before taring.");
//     }
//   };

//   const stopReading = async () => {
//     if (isClosingRef.current) return;
//     isClosingRef.current = true;
    
//     if (addTimeout) {
//       clearTimeout(addTimeout);
//       setAddTimeout(null);
//     }
    
//     readingLoopRef.current = false;
//     setIsLiveReading(false);
    
//     if (readerRef.current) {
//       try {
//         await readerRef.current.cancel();
//         await readerRef.current.releaseLock();
//       } catch (err) {
//         console.log("Reader release error:", err);
//       }
//       readerRef.current = null;
//     }
    
//     if (portRef.current) {
//       try {
//         if (portRef.current.connected) {
//           await portRef.current.close();
//         }
//       } catch (err) {
//         console.log("Port close error:", err);
//       }
//       portRef.current = null;
//     }
    
//     setIsConnected(false);
//     setIsReading(false);
//     isClosingRef.current = false;
//     onClose?.();
//   };

//   const showManualEntryPrompt = () => {
//     const manualWeight = prompt(`Enter weight for ${productName || 'item'} (in kg):`, "0.5");
//     if (manualWeight) {
//       const weight = parseFloat(manualWeight);
//       if (weight > 0) {
//         setWeight(weight);
//         onWeightStable?.(weight);
//         if (autoAdd && onWeightRead) {
//           onWeightRead(weight);
//         }
//         setTimeout(() => {
//           onClose?.();
//         }, 300);
//       }
//     }
//   };

//   const applyManualParser = () => {
//     const num = parseFloat(manualWeightInput);
//     if (!isNaN(num) && num >= 0) {
//       setUseManualParser(true);
//       setWeight(num);
//       onWeightRead(num);
//       console.log(`✅ Manual weight: ${num} kg`);
//       setDeviceInfo(`Manual weight: ${num} kg`);
//     } else {
//       alert("Please enter a valid weight");
//     }
//   };

//   useEffect(() => {
//     return () => {
//       if (addTimeout) {
//         clearTimeout(addTimeout);
//       }
//       readingLoopRef.current = false;
//       if (readerRef.current) {
//         try {
//           readerRef.current.cancel();
//           readerRef.current.releaseLock();
//         } catch (err) {}
//         readerRef.current = null;
//       }
//       if (portRef.current && portRef.current.connected) {
//         try {
//           portRef.current.close();
//         } catch (err) {}
//         portRef.current = null;
//       }
//     };
//   }, []);

//   return (
//     <div className="scale-reader p-4 border rounded-lg bg-white shadow-sm">
//       <div className="text-center">
//         {!isSerialAvailable() && (
//           <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
//             ⚠️ Web Serial API not supported. Please use Chrome or Edge.
//           </div>
//         )}

//         <div className="text-sm text-slate-500 mb-2">
//           {productName ? (
//             <span>Weighing: <span className="font-medium text-slate-700">{productName}</span></span>
//           ) : (
//             'Place item on scale'
//           )}
//         </div>

//         <div className="space-y-2 mb-3">
//           <div className="flex items-center justify-center gap-2 flex-wrap">
//             <span className={`badge ${isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
//               {isConnected ? '🔗 Connected' : '⚪ Disconnected'}
//             </span>
//             {isLiveReading && (
//               <span className="badge bg-green-100 text-green-700 animate-pulse">
//                 📡 Live ({readingsPerSecond}/s)
//               </span>
//             )}
//             {isConnected && (
//               <span className={`badge ${isStable ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
//                 {isStable ? '✅ Stable' : `⏳ ${stableCount}/5 readings`}
//               </span>
//             )}
//           </div>
          
//           {deviceInfo && (
//             <div className="text-xs text-slate-500 bg-slate-50 p-1 rounded">
//               {deviceInfo}
//             </div>
//           )}
//         </div>
        
//         <div className="text-5xl font-bold text-brand-600 my-4 font-mono">
//           {weight !== null ? `${weight.toFixed(3)}` : '0.000'}
//           <span className="text-2xl text-slate-400 ml-1">kg</span>
//         </div>

//         <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
//           <div className="bg-slate-50 p-2 rounded">
//             <div className="text-slate-400">Stability</div>
//             <div className="font-semibold text-slate-700">{stabilityProgress}%</div>
//           </div>
//           <div className="bg-slate-50 p-2 rounded">
//             <div className="text-slate-400">Readings</div>
//             <div className="font-semibold text-slate-700">{parsedWeights.length}</div>
//           </div>
//           <div className="bg-slate-50 p-2 rounded">
//             <div className="text-slate-400">Auto-Add</div>
//             <div className="font-semibold text-emerald-700">{isConfirming ? '✅ Added' : '⏳ Wait'}</div>
//           </div>
//         </div>

//         <div className="w-full bg-slate-200 rounded-full h-1.5 mb-3">
//           <div 
//             className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
//             style={{ width: `${stabilityProgress}%` }}
//           />
//         </div>

//         <div className="bg-slate-800 rounded-lg p-3 mb-3 text-left">
//           <div className="text-xs font-bold text-white mb-2">🔍 LIVE SERIAL DATA</div>
          
//           <div className="text-xs font-mono text-green-400 break-all bg-slate-900 p-1 rounded mb-1">
//             <span className="text-slate-400">Data:</span> {scaleData || 'Waiting...'}
//           </div>
          
//           <div className="text-[10px] text-emerald-400 mt-1">
//             Last parsed: {lastReadValue !== null ? `${lastReadValue.toFixed(3)} kg` : 'None'}
//           </div>
          
//           {allDataHistory.length > 0 && (
//             <div className="text-[10px] font-mono text-slate-300 bg-slate-900 p-1 rounded max-h-16 overflow-y-auto mt-1">
//               {allDataHistory.slice(-5).map((d, i) => (
//                 <div key={i}>[{allDataHistory.length - 5 + i + 1}] {d}</div>
//               ))}
//             </div>
//           )}
          
//           {parsedWeights.length > 0 && (
//             <div className="text-[10px] text-emerald-400 mt-1">
//               → {parsedWeights.slice(-5).map(w => w.toFixed(3)).join(' → ')}
//             </div>
//           )}
//         </div>

//         <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
//           <div className="text-xs font-medium text-amber-700 mb-1">Manual Test</div>
//           <div className="flex gap-2">
//             <input
//               type="number"
//               className="input py-1 text-sm flex-1"
//               placeholder="Enter weight (e.g., 1.5)"
//               value={manualWeightInput}
//               onChange={(e) => setManualWeightInput(e.target.value)}
//               step="0.001"
//             />
//             <button 
//               onClick={applyManualParser} 
//               className="btn btn-sm bg-amber-600 text-white hover:bg-amber-700 px-3 py-1"
//             >
//               Set
//             </button>
//           </div>
//         </div>

//         {error && (
//           <div className="text-red-600 text-sm bg-red-50 p-2 rounded mb-3">
//             {error}
//           </div>
//         )}

//         <div className="flex gap-2 justify-center flex-wrap">
//           {!isReading ? (
//             <>
//               <button 
//                 onClick={connectToScale} 
//                 className="btn btn-primary flex items-center gap-2"
//                 disabled={!isSerialAvailable()}
//               >
//                 <span>🔌</span> Connect Scale
//               </button>
//               <button 
//                 onClick={showManualEntryPrompt} 
//                 className="btn btn-secondary flex items-center gap-2"
//               >
//                 <span>✏️</span> Manual Entry
//               </button>
//             </>
//           ) : (
//             <>
//               <button 
//                 onClick={stopReading} 
//                 className="btn btn-secondary flex items-center gap-2"
//               >
//                 <span>⏹️</span> Cancel
//               </button>
//               <button 
//                 onClick={tareScale} 
//                 className="btn btn-warning flex items-center gap-2"
//                 disabled={weight === null}
//               >
//                 <span>⚖️</span> Tare
//               </button>
//               {isConnected && weight !== null && weight > 0 && (
//                 <button 
//                   onClick={() => {
//                     if (weight > 0) {
//                       onWeightStable?.(weight);
//                       if (autoAdd && onWeightRead) {
//                         onWeightRead(weight);
//                       }
//                       setTimeout(() => {
//                         onClose?.();
//                       }, 300);
//                     }
//                   }} 
//                   className="btn btn-primary flex items-center gap-2"
//                 >
//                   <span>✅</span> Add {weight.toFixed(2)}kg
//                 </button>
//               )}
//             </>
//           )}
//         </div>

//         <div className="mt-3 text-xs text-slate-400">
//           {!isReading ? (
//             'Click "Connect Scale" to connect your Vein Scale'
//           ) : isConnected ? (
//             isStable && weight && weight > 0 ? 
//               '✅ Weight stable. Auto-adding...' : 
//               weight === 0 ? 
//                 '⚖️ Place item on scale...' : 
//                 `⏳ Waiting for stable reading... (${stableCount}/5) - Auto-add in 3s`
//           ) : (
//             '⏳ Connecting...'
//           )}
//         </div>
        
//         <div className="mt-2 text-[10px] text-slate-400">
//           💡 Auto-adds after 3 seconds even if not stable
//         </div>
//       </div>
//     </div>
//   );
// }










