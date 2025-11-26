import React, { useState, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';

const ScreenSharingPanel = ({ 
  isScreenSharing = false,
  onToggleScreenShare,
  onWhiteboardToggle,
  className = ''
}) => {
  const [isWhiteboardActive, setIsWhiteboardActive] = useState(false);
  const [drawingMode, setDrawingMode] = useState('pen');
  const [selectedColor, setSelectedColor] = useState('#2563EB');
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleScreenShare = () => {
    onToggleScreenShare?.();
  };

  const handleWhiteboardToggle = () => {
    const newState = !isWhiteboardActive;
    setIsWhiteboardActive(newState);
    onWhiteboardToggle?.(newState);
  };

  const startDrawing = (e) => {
    if (!isWhiteboardActive) return;
    setIsDrawing(true);
    
    const canvas = canvasRef?.current;
    const rect = canvas?.getBoundingClientRect();
    const x = e?.clientX - rect?.left;
    const y = e?.clientY - rect?.top;
    
    const ctx = canvas?.getContext('2d');
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing || !isWhiteboardActive) return;
    
    const canvas = canvasRef?.current;
    const rect = canvas?.getBoundingClientRect();
    const x = e?.clientX - rect?.left;
    const y = e?.clientY - rect?.top;
    
    const ctx = canvas?.getContext('2d');
    ctx.lineWidth = drawingMode === 'pen' ? 2 : 10;
    ctx.lineCap = 'round';
    ctx.strokeStyle = drawingMode === 'eraser' ? '#FFFFFF' : selectedColor;
    
    ctx?.lineTo(x, y);
    ctx?.stroke();
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef?.current;
    const ctx = canvas?.getContext('2d');
    ctx?.clearRect(0, 0, canvas?.width, canvas?.height);
  };

  const colors = [
    '#2563EB', '#DC2626', '#059669', '#D97706', 
    '#7C3AED', '#DB2777', '#0891B2', '#65A30D'
  ];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur",
        className
      )}
    >
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.1),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.1),transparent_40%)]" />
      <div className="relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/30 dark:border-slate-700/60">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Icon name="Monitor" size={16} className="text-white sm:w-5 sm:h-5" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm sm:text-base">Screen & Whiteboard</h3>
        </div>
        
        {isScreenSharing && (
          <div className="flex items-center space-x-1 bg-success/10 text-success px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-success rounded-full animate-pulse" />
            <span className="text-[10px] sm:text-xs font-medium">Sharing</span>
          </div>
        )}
      </div>
      {/* Controls */}
      <div className="p-4 space-y-4">
        {/* Screen Share Controls */}
        <div className="space-y-2">
          <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-slate-100">Screen Sharing</div>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <Button
              variant={isScreenSharing ? "destructive" : "default"}
              size="sm"
              iconName={isScreenSharing ? "MonitorOff" : "Monitor"}
              iconPosition="left"
              onClick={handleScreenShare}
              className="text-xs h-8 sm:h-9"
            >
              <span className="hidden sm:inline">{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</span>
              <span className="sm:hidden">{isScreenSharing ? 'Stop' : 'Share'}</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              iconName="Window"
              iconPosition="left"
              className="text-xs h-8 sm:h-9"
            >
              Share Window
            </Button>
          </div>
        </div>

        {/* Whiteboard Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-slate-100">Whiteboard</div>
            <Button
              variant={isWhiteboardActive ? "destructive" : "outline"}
              size="sm"
              iconName={isWhiteboardActive ? "X" : "Edit3"}
              onClick={handleWhiteboardToggle}
              className="text-xs h-8 sm:h-9"
            >
              <span className="hidden sm:inline">{isWhiteboardActive ? 'Close' : 'Open'}</span>
              <span className="sm:hidden">{isWhiteboardActive ? 'Close' : 'Open'}</span>
            </Button>
          </div>

          {isWhiteboardActive && (
            <>
              {/* Drawing Tools */}
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <Button
                  variant={drawingMode === 'pen' ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setDrawingMode('pen')}
                >
                  <Icon name="Edit3" size={14} className="sm:w-4 sm:h-4" />
                </Button>
                
                <Button
                  variant={drawingMode === 'eraser' ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setDrawingMode('eraser')}
                >
                  <Icon name="Eraser" size={14} className="sm:w-4 sm:h-4" />
                </Button>
                
                <div className="w-px h-6 bg-border" />
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearCanvas}
                >
                  <Icon name="Trash2" size={14} className="sm:w-4 sm:h-4" />
                </Button>
              </div>

              {/* Color Palette */}
              <div className="flex items-center space-x-1">
                {colors?.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition-all duration-200 ${
                      selectedColor === color ? 'border-foreground scale-110' : 'border-border'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Whiteboard Canvas */}
      {isWhiteboardActive && (
        <div className="p-4 pt-0">
          <div className="border border-white/40 dark:border-slate-700/60 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-inner">
            <canvas
              ref={canvasRef}
              width={400}
              height={300}
              className="w-full cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>
          
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-slate-400">
            <span>Click and drag to draw</span>
            <div className="flex items-center space-x-2">
              <Icon name="Save" size={12} />
              <span>Auto-saved</span>
            </div>
          </div>
        </div>
      )}
      {/* Screen Share Preview */}
      {isScreenSharing && (
        <div className="p-4 pt-0">
          <div className="aspect-video bg-gray-900/80 rounded-2xl border border-white/20 dark:border-slate-700/60 flex items-center justify-center text-white">
            <div className="text-center space-y-2">
              <Icon name="Monitor" size={32} className="text-white/70 mx-auto" />
              <p className="text-sm text-white/80">Screen sharing active</p>
              <p className="text-xs text-white/60">Your screen is visible to the interviewer</p>
            </div>
          </div>
        </div>
      )}
      {/* Footer */}
      <div className="p-4 border-t border-white/30 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/70">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
          <span>Technical interview tools</span>
          <div className="flex items-center space-x-1">
            <Icon name="Zap" size={12} />
            <span>Real-time collaboration</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ScreenSharingPanel;