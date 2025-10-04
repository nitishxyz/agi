import React from 'react';
import { Hash, Clock, DollarSign } from 'lucide-react';
import type { Session } from '../types/session';

interface SessionHeaderProps {
  session: Session;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({ session }) => {
  const formatNumber = (num: number) => num.toLocaleString();
  
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const calculateCost = () => {
    // Approximate pricing for Claude models (per 1M tokens)
    const inputCostPer1M = 3.00;  // $3 per 1M input tokens
    const outputCostPer1M = 15.00; // $15 per 1M output tokens
    
    const inputCost = (session.tokenUsage.inputTokens / 1_000_000) * inputCostPer1M;
    const outputCost = (session.tokenUsage.outputTokens / 1_000_000) * outputCostPer1M;
    const totalCost = inputCost + outputCost;
    
    if (totalCost < 0.01) return '<$0.01';
    return `$${totalCost.toFixed(2)}`;
  };

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-6 py-4">
        <h1 className="text-2xl font-semibold mb-3">{session.title}</h1>
        
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4" />
            <span>
              {formatNumber(session.tokenUsage.totalTokens)} tokens
              <span className="text-xs ml-1">
                ({formatNumber(session.tokenUsage.inputTokens)} in / {formatNumber(session.tokenUsage.outputTokens)} out)
              </span>
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{formatTime(session.totalToolTime)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            <span>{calculateCost()}</span>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs">
              {session.provider} · {session.model} · {session.agent}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
