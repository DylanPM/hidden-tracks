import React, { useState, useEffect } from 'react';
import { X, BarChart3, RefreshCw } from 'lucide-react';

/**
 * AlgorithmDebugModal
 * Displays statistics about the guess algorithm performance
 * Tracks correct/total ratio across multiple games
 */

const STATS_KEY = 'hiddenTracks_algorithmStats';

export function AlgorithmDebugModal({ enabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    loadStats();
  }, [enabled]);

  const loadStats = () => {
    const stored = localStorage.getItem(STATS_KEY);
    if (stored) {
      setStats(JSON.parse(stored));
    } else {
      setStats({
        totalSets: 0,
        totalOptions: 0,
        totalCorrect: 0,
        distribution: {
          0: 0, // 0 correct in set
          1: 0, // 1 correct in set
          2: 0, // 2 correct in set
          3: 0, // 3 correct in set
        },
        lastUpdated: Date.now(),
      });
    }
  };

  const resetStats = () => {
    localStorage.removeItem(STATS_KEY);
    loadStats();
  };

  if (!enabled || !stats) return null;

  const avgCorrectPerSet = stats.totalSets > 0 ? stats.totalCorrect / stats.totalSets : 0;
  const avgPercentCorrect = stats.totalOptions > 0 ? (stats.totalCorrect / stats.totalOptions) * 100 : 0;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-full shadow-lg z-50 transition"
        title="Toggle Algorithm Debug Stats"
      >
        <BarChart3 className="w-6 h-6" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 bg-zinc-900 border-2 border-purple-500 rounded-lg p-4 w-96 shadow-2xl z-50">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Algorithm Stats
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Summary Stats */}
            <div className="bg-zinc-800 rounded p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-sm">Total Sets Generated:</span>
                <span className="text-white font-bold">{stats.totalSets}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-sm">Total Options Shown:</span>
                <span className="text-white font-bold">{stats.totalOptions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-sm">Total Correct Options:</span>
                <span className="text-green-400 font-bold">{stats.totalCorrect}</span>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="bg-zinc-800 rounded p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-sm">Avg Correct per Set:</span>
                <span className={`font-bold text-lg ${
                  avgCorrectPerSet >= 0.9 && avgCorrectPerSet <= 1.1
                    ? 'text-green-400'
                    : avgCorrectPerSet >= 0.7 && avgCorrectPerSet <= 1.3
                    ? 'text-yellow-400'
                    : 'text-red-400'
                }`}>
                  {avgCorrectPerSet.toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-zinc-500 text-center">
                Target: ~1.00 (one correct per set)
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-sm">Overall % Correct:</span>
                <span className="text-purple-400 font-bold">
                  {avgPercentCorrect.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Distribution */}
            <div className="bg-zinc-800 rounded p-3">
              <h4 className="text-white font-semibold text-sm mb-2">Distribution:</h4>
              <div className="space-y-1">
                {[0, 1, 2, 3].map((num) => {
                  const count = stats.distribution[num] || 0;
                  const percentage = stats.totalSets > 0 ? (count / stats.totalSets) * 100 : 0;

                  return (
                    <div key={num} className="flex items-center gap-2">
                      <span className="text-zinc-400 text-xs w-20">{num} correct:</span>
                      <div className="flex-1 bg-zinc-700 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            num === 1 ? 'bg-green-500' : 'bg-purple-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-white text-xs font-bold w-16 text-right">
                        {count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={resetStats}
              className="w-full bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Stats
            </button>

            <p className="text-xs text-zinc-500 text-center">
              Last updated: {new Date(stats.lastUpdated).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Track a new set of multiple choice options
 */
export function trackAlgorithmStats(options) {
  const stored = localStorage.getItem(STATS_KEY);
  const stats = stored
    ? JSON.parse(stored)
    : {
        totalSets: 0,
        totalOptions: 0,
        totalCorrect: 0,
        distribution: { 0: 0, 1: 0, 2: 0, 3: 0 },
        lastUpdated: Date.now(),
      };

  const correctCount = options.filter(opt => opt.correct).length;
  const optionCount = options.length;

  stats.totalSets += 1;
  stats.totalOptions += optionCount;
  stats.totalCorrect += correctCount;
  stats.distribution[correctCount] = (stats.distribution[correctCount] || 0) + 1;
  stats.lastUpdated = Date.now();

  localStorage.setItem(STATS_KEY, JSON.stringify(stats));

  // Also log to console
  console.log(
    `🎲 Algorithm Stats: ${correctCount}/${optionCount} correct | ` +
    `Running avg: ${(stats.totalCorrect / stats.totalSets).toFixed(2)} per set | ` +
    `Total: ${stats.totalCorrect}/${stats.totalOptions} (${((stats.totalCorrect / stats.totalOptions) * 100).toFixed(1)}%)`
  );
}
