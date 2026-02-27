/**
 * VoiceSpeechAnalyzer
 *
 * Analyses spoken-word data from the interview transcript to surface:
 * - Words Per Minute (WPM)
 * - Filler word frequency (um, uh, like, you know, basically, etc.)
 * - Estimated pause count (gaps between utterances)
 * - Vocabulary diversity (unique word ratio)
 * - Sentence average length
 * - Readability / fluency score (derived metric)
 *
 * Input: `transcript` – array of { speaker, text, startTime?, endTime? } OR a raw string.
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Icon from '../AppIcon';

const FILLER_WORDS = [
  'um', 'uh', 'er', 'hmm', 'like', 'you know', 'basically', 'literally',
  'actually', 'right', 'so', 'well', 'i mean', 'kind of', 'sort of',
  'okay', 'yeah', 'just',
];

const tokenize = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0);

const analyseSpeech = (transcript, durationSeconds) => {
  let rawText = '';
  let pauseCount = 0;

  if (Array.isArray(transcript)) {
    const candidateUtterances = transcript.filter((t) => t?.speaker?.toLowerCase() !== 'ai' && t?.speaker?.toLowerCase() !== 'interviewer');
    rawText = candidateUtterances.map((t) => t.text || t.content || '').join(' ');

    // Estimate pauses from gaps between utterances (> 3s gap = pause)
    for (let i = 1; i < candidateUtterances.length; i++) {
      const prev = candidateUtterances[i - 1];
      const curr = candidateUtterances[i];
      if (prev?.endTime && curr?.startTime) {
        const gap = (curr.startTime - prev.endTime) / 1000;
        if (gap > 3) pauseCount++;
      }
    }
  } else {
    rawText = String(transcript || '');
  }

  const words = tokenize(rawText);
  const wordCount = words.length;
  const sentences = (rawText.match(/[.!?]+/g) || []).length || Math.max(1, Math.round(wordCount / 15));
  const durationMin = durationSeconds ? durationSeconds / 60 : Math.max(1, wordCount / 130);
  const wpm = durationMin > 0 ? Math.round(wordCount / durationMin) : 0;

  // Filler word analysis
  const fillerCounts = {};
  let totalFillers = 0;
  FILLER_WORDS.forEach((filler) => {
    const regex = new RegExp(`\\b${filler.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    const matches = rawText.match(regex) || [];
    if (matches.length > 0) {
      fillerCounts[filler] = matches.length;
      totalFillers += matches.length;
    }
  });

  const fillerRate = wordCount > 0 ? Math.round((totalFillers / wordCount) * 100) : 0;

  // Vocabulary diversity
  const uniqueWords = new Set(words).size;
  const vocabDiversity = wordCount > 0 ? Math.round((uniqueWords / wordCount) * 100) : 0;

  // Average sentence length
  const avgSentenceLength = sentences > 0 ? Math.round(wordCount / sentences) : 0;

  // Fluency score (composite)
  // Ideal WPM: 130-160. Ideal filler rate: < 3%. Ideal vocab diversity: > 40%.
  const wpmScore = wpm >= 100 && wpm <= 180
    ? 100 - Math.abs(wpm - 140) / 2
    : wpm < 100
    ? Math.max(0, wpm * 0.6)
    : Math.max(0, 100 - (wpm - 180) * 0.8);
  const fillerScore = Math.max(0, 100 - fillerRate * 10);
  const vocabScore = Math.min(100, vocabDiversity * 1.5);
  const fluencyScore = Math.round((wpmScore * 0.4 + fillerScore * 0.35 + vocabScore * 0.25));

  // Top filler words chart data
  const fillerChartData = Object.entries(fillerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));

  return {
    wordCount,
    wpm,
    sentences,
    avgSentenceLength,
    uniqueWords,
    vocabDiversity,
    totalFillers,
    fillerRate,
    fillerCounts,
    fillerChartData,
    pauseCount,
    fluencyScore,
    wpmScore: Math.round(wpmScore),
    fillerScore: Math.round(fillerScore),
    vocabScore: Math.round(vocabScore),
  };
};

const ScoreGauge = ({ label, score, description, color }) => {
  const colorClass = score >= 75 ? 'text-emerald-600 dark:text-emerald-400' : score >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
  const barColor = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/20 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700 dark:text-slate-300">{label}</span>
        <span className={`text-sm font-bold ${colorClass}`}>{score}%</span>
      </div>
      <div className="bg-gray-200 dark:bg-slate-600 rounded-full h-1.5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: barColor }}
        />
      </div>
      {description && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{description}</p>}
    </div>
  );
};

const VoiceSpeechAnalyzer = ({ transcript, durationSeconds, compact = false }) => {
  const analysis = useMemo(
    () => analyseSpeech(transcript, durationSeconds),
    [transcript, durationSeconds]
  );

  const hasData = analysis.wordCount > 0;

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-lg text-center py-10">
        <Icon name="Mic" size={32} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
        <p className="text-sm text-gray-400 dark:text-slate-500">No transcript available for speech analysis.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-gray-600 dark:text-slate-300">
          <Icon name="Gauge" size={12} className="text-blue-500" /> {analysis.wpm} WPM
        </span>
        <span className="flex items-center gap-1 text-gray-600 dark:text-slate-300">
          <Icon name="AlertTriangle" size={12} className="text-orange-500" /> {analysis.fillerRate}% fillers
        </span>
        <span className="flex items-center gap-1 text-gray-600 dark:text-slate-300">
          <Icon name="Star" size={12} className="text-purple-500" /> {analysis.fluencyScore}% fluency
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
        <Icon name="AudioLines" size={16} className="text-indigo-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Voice & Speech Analysis</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Key Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Words', value: analysis.wordCount.toLocaleString(), icon: 'Type', color: 'blue' },
            { label: 'WPM', value: analysis.wpm, icon: 'Gauge', color: analysis.wpm >= 100 && analysis.wpm <= 180 ? 'emerald' : 'orange' },
            { label: 'Filler Words', value: analysis.totalFillers, icon: 'AlertTriangle', color: analysis.totalFillers > 10 ? 'red' : 'yellow' },
            { label: 'Fluency', value: `${analysis.fluencyScore}%`, icon: 'Sparkles', color: analysis.fluencyScore >= 70 ? 'emerald' : 'orange' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-gray-50 dark:bg-slate-700/30 border border-gray-100 dark:border-slate-700 p-3 text-center">
              <Icon name={stat.icon} size={16} className={`mx-auto mb-1 text-${stat.color}-500`} />
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Scores */}
        <div className="space-y-2">
          <ScoreGauge
            label="Speaking Pace"
            score={analysis.wpmScore}
            description={`${analysis.wpm} WPM · Ideal: 130–160 WPM`}
          />
          <ScoreGauge
            label="Filler Word Control"
            score={analysis.fillerScore}
            description={`${analysis.fillerRate}% filler rate · ${analysis.totalFillers} filler words total`}
          />
          <ScoreGauge
            label="Vocabulary Diversity"
            score={analysis.vocabScore}
            description={`${analysis.uniqueWords} unique words · ${analysis.vocabDiversity}% diversity ratio`}
          />
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 p-2.5 text-center">
            <p className="text-base font-bold text-gray-900 dark:text-slate-100">{analysis.avgSentenceLength}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Avg. words/sentence</p>
          </div>
          {analysis.pauseCount > 0 && (
            <div className="rounded-xl border border-gray-100 dark:border-slate-700 p-2.5 text-center">
              <p className="text-base font-bold text-gray-900 dark:text-slate-100">{analysis.pauseCount}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Notable pauses</p>
            </div>
          )}
        </div>

        {/* Filler Words Chart */}
        {analysis.fillerChartData.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Icon name="AlertTriangle" size={12} className="text-orange-500" />
              Most Used Filler Words
            </h3>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysis.fillerChartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <XAxis dataKey="word" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 8 }}
                    formatter={(v) => [v, 'count']}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {analysis.fillerChartData.map((_, i) => (
                      <Cell key={i} fill="#f59e0b" opacity={0.8 - i * 0.08} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Interpretation */}
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 p-3">
          <h3 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1.5">Interpretation</h3>
          <ul className="space-y-1.5 text-xs text-gray-700 dark:text-slate-300">
            {analysis.wpm < 100 && <li>• Speaking pace is slow ({analysis.wpm} WPM). Try to maintain 130–160 WPM for clarity.</li>}
            {analysis.wpm > 180 && <li>• Speaking pace is too fast ({analysis.wpm} WPM). Slow down for better comprehension.</li>}
            {analysis.wpm >= 100 && analysis.wpm <= 180 && <li>• Speaking pace is good ({analysis.wpm} WPM). Well within the ideal range.</li>}
            {analysis.fillerRate > 5 && <li>• High filler word usage ({analysis.fillerRate}%). Practice pausing instead of using fillers.</li>}
            {analysis.fillerRate <= 3 && <li>• Excellent filler word control. Very clean speech delivery.</li>}
            {analysis.vocabDiversity >= 50 && <li>• Strong vocabulary diversity ({analysis.vocabDiversity}%). Demonstrates good command of language.</li>}
            {analysis.vocabDiversity < 30 && <li>• Vocabulary diversity is low ({analysis.vocabDiversity}%). Try using varied vocabulary.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VoiceSpeechAnalyzer;
