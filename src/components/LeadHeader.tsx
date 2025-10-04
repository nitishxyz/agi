import React from 'react';
import { Hash, DollarSign } from 'lucide-react';
import type { Session } from '../types/session';

interface LeadHeaderProps {
  session: Session;
  isVisible: boolean;
}

export const LeadHeader: React.FC<LeadHeaderProps> = ({ session, isVisible }) => {
  const formatNumber = (num: number) => num.toLocaleString();
  
  const calculateCost = () => {
    const inputCostPer1M = 3.00;
    const outputCostPer1M = 15.00;
    
    const inputCost = (session.tokenUsage.inputTokens / 1_000_000) * inputCostPer1M;
    const outputCost = (session.tokenUsage.outputTokens / 1_000_000) * outputCostPer1M;
    const totalCost = inputCost + outputCost;
    
    if (totalCost < 0.01) return '<$0.01';
    return `$${totalCost.toFixed(2)}`;
  };

  return (
    <div
      className={`fixed top-0 left-64 right-0 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 transition-transform duration-200 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="h-full px-6 flex items-center justify-end gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4" />
          <span>{formatNumber(session.tokenUsage.totalTokens)}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          <span>{calculateCost()}</span>
        </div>
      </div>
    </div>
  );
};
