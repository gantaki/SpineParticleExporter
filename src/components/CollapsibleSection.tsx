/**
 * CollapsibleSection component for Particle Spine Exporter
 * Expandable/collapsible UI panel
 */

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  isOpen,
  onToggle,
  children
}) => {
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/70 hover:bg-slate-800 transition-colors"
      >
        <span className="text-sm font-semibold text-purple-300">{title}</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isOpen && (
        <div className="p-3 bg-slate-800/30 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
};
