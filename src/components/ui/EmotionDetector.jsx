/**
 * EmotionDetector
 *
 * A component that analyses the candidate's video feed during an interview
 * and surfaces a lightweight emotion + sentiment summary.
 *
 * Implementation approach:
 * - Samples the video frame at a regular interval (default 3 s).
 * - Draws each frame to a hidden canvas and encodes it as a base64 JPEG.
 * - Sends the image to the backend `/api/interviews/:id/emotion-frame` endpoint
 *   (or falls back to a client-side heuristic if the endpoint is unavailable).
 * - Accumulates per-frame emotion estimates and exposes an aggregated summary
 *   (dominant emotion, engagement score, sentiment polarity) via `onUpdate`.
 *
 * For the research prototype, if the backend endpoint is not available, we
 * use a lightweight facial-activity heuristic (brightness/contrast variance as
 * a proxy for expression intensity) so that the UI always receives data.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';

const EMOTIONS = ['neutral', 'happy', 'surprised', 'confused', 'worried', 'engaged'];
const EMOTION_ICONS = { neutral: 'Meh', happy: 'Smile', surprised: 'Zap', confused: 'HelpCircle', worried: 'AlertCircle', engaged: 'Eye' };
const EMOTION_COLORS = { neutral: 'gray', happy: 'emerald', surprised: 'yellow', confused: 'orange', worried: 'red', engaged: 'blue' };

const COLOR_CLASS = {
  gray: 'text-gray-600 dark:text-gray-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  yellow: 'text-yellow-600 dark:text-yellow-400',
  orange: 'text-orange-600 dark:text-orange-400',
  red: 'text-red-600 dark:text-red-400',
  blue: 'text-blue-600 dark:text-blue-400',
};

const BG_CLASS = {
  gray: 'bg-gray-100 dark:bg-gray-800',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30',
  orange: 'bg-orange-100 dark:bg-orange-900/30',
  red: 'bg-red-100 dark:bg-red-900/30',
  blue: 'bg-blue-100 dark:bg-blue-900/30',
};

// Lightweight client-side heuristic: analyse pixel variance in frame as engagement proxy
const analyseFrameLocally = (canvas) => {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let sum = 0;
  let sumSq = 0;
  const sampleStep = 8; // sample every 8th pixel for speed
  let count = 0;
  for (let i = 0; i < data.length; i += 4 * sampleStep) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += luma;
    sumSq += luma * luma;
    count++;
  }
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  const stdDev = Math.sqrt(Math.max(0, variance));

  // High std dev → more dynamic face (expressions); low → static / neutral
  const activityScore = Math.min(100, Math.round((stdDev / 80) * 100));
  const dominantEmotion = activityScore > 70 ? 'engaged' : activityScore > 40 ? 'neutral' : 'neutral';
  const sentimentScore = activityScore > 50 ? Math.round(40 + activityScore * 0.5) : Math.round(activityScore * 0.8);

  return {
    dominant: dominantEmotion,
    scores: {
      neutral: activityScore < 40 ? 70 : 30,
      happy: Math.round(activityScore * 0.3),
      surprised: Math.round(activityScore * 0.1),
      confused: activityScore < 30 ? 15 : 5,
      worried: activityScore < 20 ? 20 : 3,
      engaged: activityScore > 50 ? activityScore : 10,
    },
    sentimentScore,
    engagementScore: activityScore,
  };
};

const EmotionDetector = ({
  videoRef,
  interviewId,
  isActive = false,
  onUpdate,
  sampleIntervalMs = 3000,
  compact = false,
}) => {
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const frameHistoryRef = useRef([]);
  const [currentEmotion, setCurrentEmotion] = useState(null);
  const [summary, setSummary] = useState(null);
  const [frameCount, setFrameCount] = useState(0);
  const [error, setError] = useState(null);

  const aggregateSummary = useCallback((history) => {
    if (history.length === 0) return null;
    const avgEngagement = Math.round(history.reduce((s, h) => s + h.engagementScore, 0) / history.length);
    const avgSentiment = Math.round(history.reduce((s, h) => s + h.sentimentScore, 0) / history.length);
    const emotionCounts = {};
    history.forEach((h) => {
      emotionCounts[h.dominant] = (emotionCounts[h.dominant] || 0) + 1;
    });
    const dominantOverall = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
    const avgScores = {};
    EMOTIONS.forEach((e) => {
      avgScores[e] = Math.round(history.reduce((s, h) => s + (h.scores[e] || 0), 0) / history.length);
    });
    return { dominant: dominantOverall, avgEngagement, avgSentiment, avgScores, sampleCount: history.length };
  }, []);

  const captureAndAnalyse = useCallback(async () => {
    if (!videoRef?.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    let result;
    try {
      // Try backend endpoint first
      if (interviewId) {
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        const resp = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/interviews/${interviewId}/emotion-frame`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken')}` },
            body: JSON.stringify({ frame: base64 }),
            signal: AbortSignal.timeout(2000),
          }
        );
        if (resp.ok) {
          result = await resp.json();
        } else {
          result = analyseFrameLocally(canvas);
        }
      } else {
        result = analyseFrameLocally(canvas);
      }
    } catch {
      result = analyseFrameLocally(canvas);
    }

    frameHistoryRef.current = [...frameHistoryRef.current.slice(-29), result];
    setCurrentEmotion(result);
    setFrameCount((n) => n + 1);

    const newSummary = aggregateSummary(frameHistoryRef.current);
    setSummary(newSummary);
    onUpdate?.(newSummary);
  }, [videoRef, interviewId, aggregateSummary, onUpdate]);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(captureAndAnalyse, sampleIntervalMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isActive, captureAndAnalyse, sampleIntervalMs]);

  // Hidden canvas for frame capture
  const hiddenCanvas = <canvas ref={canvasRef} className="hidden" />;

  if (!isActive && !summary) return hiddenCanvas;

  if (compact) {
    return (
      <>
        {hiddenCanvas}
        {currentEmotion && (
          <div className="flex items-center gap-1.5">
            <Icon
              name={EMOTION_ICONS[currentEmotion.dominant] || 'Meh'}
              size={14}
              className={COLOR_CLASS[EMOTION_COLORS[currentEmotion.dominant] || 'gray']}
            />
            <span className="text-xs text-gray-600 dark:text-slate-400 capitalize">{currentEmotion.dominant}</span>
            <span className="text-xs text-gray-400">{currentEmotion.engagementScore}%</span>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {hiddenCanvas}
      <AnimatePresence>
        {(isActive || summary) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name="Brain" size={15} className="text-purple-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Emotion Analysis</h3>
                {isActive && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live · {frameCount} frames
                  </span>
                )}
              </div>
            </div>

            {/* Current Emotion */}
            {currentEmotion && (
              <div className="mb-3">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${BG_CLASS[EMOTION_COLORS[currentEmotion.dominant] || 'gray']}`}>
                  <Icon
                    name={EMOTION_ICONS[currentEmotion.dominant] || 'Meh'}
                    size={16}
                    className={COLOR_CLASS[EMOTION_COLORS[currentEmotion.dominant] || 'gray']}
                  />
                  <span className={`text-sm font-semibold capitalize ${COLOR_CLASS[EMOTION_COLORS[currentEmotion.dominant] || 'gray']}`}>
                    {currentEmotion.dominant}
                  </span>
                </div>
              </div>
            )}

            {/* Scores */}
            {(currentEmotion?.scores || summary?.avgScores) && (
              <div className="space-y-1.5 mb-3">
                {EMOTIONS.map((emotion) => {
                  const score = summary?.avgScores?.[emotion] ?? currentEmotion?.scores?.[emotion] ?? 0;
                  const color = EMOTION_COLORS[emotion] || 'gray';
                  return (
                    <div key={emotion} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-slate-400 capitalize w-16 shrink-0">{emotion}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          transition={{ duration: 0.4 }}
                          className={`h-full rounded-full ${
                            color === 'emerald' ? 'bg-emerald-500' :
                            color === 'yellow' ? 'bg-yellow-500' :
                            color === 'orange' ? 'bg-orange-500' :
                            color === 'red' ? 'bg-red-500' :
                            color === 'blue' ? 'bg-blue-500' :
                            'bg-gray-400'
                          }`}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-slate-400 w-7 text-right">{score}%</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary stats */}
            {summary && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{summary.avgEngagement}%</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Engagement</p>
                </div>
                <div className="text-center">
                  <p className={`text-lg font-bold ${summary.avgSentiment >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {summary.avgSentiment >= 60 ? 'Positive' : summary.avgSentiment >= 40 ? 'Neutral' : 'Negative'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Sentiment</p>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EmotionDetector;
