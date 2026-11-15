import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Wrench } from 'lucide-react';

interface TouchControlsProps {
  onDirHold: (dir: 'up' | 'down' | 'left' | 'right', pressed: boolean) => void;
  onAction: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ onDirHold, onAction }) => {
  const bindHold = (dir: 'up' | 'down' | 'left' | 'right') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      onDirHold(dir, true);
    },
    onPointerUp: () => onDirHold(dir, false),
    onPointerLeave: () => onDirHold(dir, false),
    onPointerCancel: () => onDirHold(dir, false),
  });

  return (
    <div className="md:hidden fixed inset-x-4 bottom-4 z-20 flex items-end justify-between pointer-events-none">
      {/* Compact D-Pad */}
      <div className="grid grid-cols-3 gap-1 w-32 h-32 pointer-events-auto opacity-85">
        <div />
        <button
          type="button"
          aria-label="Move Up"
          {...bindHold('up')}
          className="pixel-btn bg-[#2f3338]/90 text-stone-100 flex items-center justify-center rounded-sm active:bg-sky-600"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
        <div />
        <button
          type="button"
          aria-label="Move Left"
          {...bindHold('left')}
          className="pixel-btn bg-[#2f3338]/90 text-stone-100 flex items-center justify-center rounded-sm active:bg-sky-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="bg-[#1b1e22]/70 rounded-sm" />
        <button
          type="button"
          aria-label="Move Right"
          {...bindHold('right')}
          className="pixel-btn bg-[#2f3338]/90 text-stone-100 flex items-center justify-center rounded-sm active:bg-sky-600"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div />
        <button
          type="button"
          aria-label="Move Down"
          {...bindHold('down')}
          className="pixel-btn bg-[#2f3338]/90 text-stone-100 flex items-center justify-center rounded-sm active:bg-sky-600"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
        <div />
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={onAction}
        aria-label="Interact or Repair"
        className="pointer-events-auto pixel-btn bg-sky-600/90 active:bg-sky-500 text-white w-14 h-14 rounded-sm flex items-center justify-center shadow-lg"
      >
        <Wrench className="w-6 h-6" />
      </button>
    </div>
  );
};
