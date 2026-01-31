/**
 * Video Analyzer Component
 * 
 * Analyzes recorded videos using MediaPipe to extract posture metrics.
 * Features:
 * - Load videos from recordings or file upload
 * - Frame-by-frame MediaPipe analysis
 * - Extract pose and face-mesh metrics
 * - Generate statistics for good vs bad examples
 * - Export analysis results as JSON
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PoseLandmarker, FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import {
  POSE_LANDMARKS,
  FACE_LANDMARKS,
  calculateEAR,
  calculateMAR,
  calculateFaceOrientation,
} from '../../../config/mediapipeReferenceData';

const VideoAnalyzer = () => {
  const toast = useToast();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recordings, setRecordings] = useState([]);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [poseLandmarker, setPoseLandmarker] = useState(null);
  const [faceLandmarker, setFaceLandmarker] = useState(null);

  // Load recordings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('research_video_recordings');
    if (saved) {
      try {
        setRecordings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load recordings:', e);
      }
    }

    // Load previous analysis results
    const analysisData = localStorage.getItem('research_analysis_results');
    if (analysisData) {
      try {
        setAnalysisResults(JSON.parse(analysisData));
      } catch (e) {
        console.error('Failed to load analysis results:', e);
      }
    }
  }, []);

  // Initialize MediaPipe
  const initializeMediaPipe = useCallback(async () => {
    try {
      toast.info('Initializing MediaPipe...');
      
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const poseDetector = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });

      const faceDetector = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });

      setPoseLandmarker(poseDetector);
      setFaceLandmarker(faceDetector);
      setIsInitialized(true);
      toast.success('MediaPipe initialized successfully!');
    } catch (error) {
      console.error('MediaPipe init error:', error);
      toast.error('Failed to initialize MediaPipe');
    }
  }, [toast]);

  // Load video blob from IndexedDB
  const loadVideoBlob = (recordingId) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ResearchVideoDB', 1);
      
      request.onerror = () => reject(new Error('IndexedDB error'));
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['videos'], 'readonly');
        const store = transaction.objectStore('videos');
        const getRequest = store.get(recordingId);
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            resolve(getRequest.result.blob);
          } else {
            reject(new Error('Video not found'));
          }
        };
        
        getRequest.onerror = () => reject(new Error('Failed to get video'));
      };
    });
  };

  // Analyze a single frame
  const analyzeFrame = useCallback((video, timestamp) => {
    const metrics = {
      timestamp,
      pose: null,
      face: null,
    };

    // Pose detection
    if (poseLandmarker) {
      const poseResults = poseLandmarker.detectForVideo(video, timestamp);
      if (poseResults.landmarks && poseResults.landmarks.length > 0) {
        const landmarks = poseResults.landmarks[0];
        
        // Calculate posture metrics
        const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        const nose = landmarks[POSE_LANDMARKS.NOSE];
        const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
        const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

        if (leftShoulder && rightShoulder) {
          const shoulderSlope = Math.abs(leftShoulder.y - rightShoulder.y);
          const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
          const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
          
          const headForward = nose ? (nose.z - shoulderMidX) : 0;
          const headTilt = nose ? Math.abs(nose.x - shoulderMidX) : 0;

          metrics.pose = {
            shoulderSlope,
            shoulderMidX,
            shoulderMidY,
            headForward,
            headTilt,
            headY: nose?.y || 0,
            leftWrist: leftWrist ? { x: leftWrist.x, y: leftWrist.y, z: leftWrist.z } : null,
            rightWrist: rightWrist ? { x: rightWrist.x, y: rightWrist.y, z: rightWrist.z } : null,
            landmarks: landmarks.map(l => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility })),
          };
        }
      }
    }

    // Face detection
    if (faceLandmarker) {
      const faceResults = faceLandmarker.detectForVideo(video, timestamp);
      if (faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
        const landmarks = faceResults.faceLandmarks[0];
        
        // Eye Aspect Ratio
        const leftEAR = calculateEAR(
          landmarks[FACE_LANDMARKS.LEFT_EYE_TOP],
          landmarks[FACE_LANDMARKS.LEFT_EYE_BOTTOM],
          landmarks[FACE_LANDMARKS.LEFT_EYE_LEFT],
          landmarks[FACE_LANDMARKS.LEFT_EYE_RIGHT]
        );
        
        const rightEAR = calculateEAR(
          landmarks[FACE_LANDMARKS.RIGHT_EYE_TOP],
          landmarks[FACE_LANDMARKS.RIGHT_EYE_BOTTOM],
          landmarks[FACE_LANDMARKS.RIGHT_EYE_LEFT],
          landmarks[FACE_LANDMARKS.RIGHT_EYE_RIGHT]
        );
        
        const avgEAR = (leftEAR + rightEAR) / 2;
        
        // Mouth Aspect Ratio
        const mar = calculateMAR(
          landmarks[FACE_LANDMARKS.UPPER_LIP],
          landmarks[FACE_LANDMARKS.LOWER_LIP],
          landmarks[FACE_LANDMARKS.LIPS_OUTER[0]],
          landmarks[FACE_LANDMARKS.LIPS_OUTER[10]]
        );
        
        // Face orientation
        const orientation = calculateFaceOrientation(
          landmarks[FACE_LANDMARKS.NOSE_TIP],
          landmarks[FACE_LANDMARKS.LEFT_EYE_LEFT],
          landmarks[FACE_LANDMARKS.RIGHT_EYE_RIGHT],
          landmarks[FACE_LANDMARKS.CHIN]
        );

        metrics.face = {
          leftEAR,
          rightEAR,
          avgEAR,
          mar,
          yaw: orientation.yaw,
          pitch: orientation.pitch,
          roll: orientation.roll,
          blendshapes: faceResults.faceBlendshapes?.[0] || null,
        };
      }
    }

    return metrics;
  }, [poseLandmarker, faceLandmarker]);

  // Analyze video
  const analyzeVideo = useCallback(async (recording) => {
    if (!isInitialized) {
      toast.warning('Please initialize MediaPipe first');
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setSelectedRecording(recording);

    try {
      const blob = await loadVideoBlob(recording.id);
      const url = URL.createObjectURL(blob);
      
      const video = videoRef.current;
      video.src = url;
      
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      const duration = video.duration;
      const fps = 10; // Analyze 10 frames per second
      const frameInterval = 1000 / fps;
      const totalFrames = Math.floor(duration * fps);
      
      const frameMetrics = [];
      
      for (let i = 0; i < totalFrames; i++) {
        const currentTime = i / fps;
        video.currentTime = currentTime;
        
        await new Promise((resolve) => {
          video.onseeked = resolve;
        });
        
        const timestamp = Math.floor(currentTime * 1000);
        const metrics = analyzeFrame(video, timestamp);
        frameMetrics.push(metrics);
        
        setProgress(Math.round((i / totalFrames) * 100));
      }

      // Calculate statistics
      const analysis = calculateStatistics(frameMetrics, recording);
      setCurrentAnalysis(analysis);
      
      // Save results
      const newResults = [...analysisResults.filter(r => r.recordingId !== recording.id), analysis];
      setAnalysisResults(newResults);
      localStorage.setItem('research_analysis_results', JSON.stringify(newResults));
      localStorage.setItem('research_analysis_count', newResults.length.toString());
      
      URL.revokeObjectURL(url);
      toast.success('Analysis complete!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze video: ' + error.message);
    } finally {
      setIsAnalyzing(false);
      setProgress(100);
    }
  }, [isInitialized, analyzeFrame, analysisResults, toast]);

  // Calculate statistics from frame metrics
  const calculateStatistics = (frameMetrics, recording) => {
    const validPoseFrames = frameMetrics.filter(f => f.pose);
    const validFaceFrames = frameMetrics.filter(f => f.face);

    const stats = {
      recordingId: recording.id,
      category: recording.category,
      quality: recording.quality,
      description: recording.description,
      analyzedAt: new Date().toISOString(),
      totalFrames: frameMetrics.length,
      validPoseFrames: validPoseFrames.length,
      validFaceFrames: validFaceFrames.length,
      pose: {},
      face: {},
    };

    // Pose statistics
    if (validPoseFrames.length > 0) {
      const shoulderSlopes = validPoseFrames.map(f => f.pose.shoulderSlope);
      const headTilts = validPoseFrames.map(f => f.pose.headTilt);
      const headForwards = validPoseFrames.map(f => f.pose.headForward);

      stats.pose = {
        shoulderSlope: {
          mean: average(shoulderSlopes),
          std: standardDeviation(shoulderSlopes),
          min: Math.min(...shoulderSlopes),
          max: Math.max(...shoulderSlopes),
        },
        headTilt: {
          mean: average(headTilts),
          std: standardDeviation(headTilts),
          min: Math.min(...headTilts),
          max: Math.max(...headTilts),
        },
        headForward: {
          mean: average(headForwards),
          std: standardDeviation(headForwards),
          min: Math.min(...headForwards),
          max: Math.max(...headForwards),
        },
      };
    }

    // Face statistics
    if (validFaceFrames.length > 0) {
      const ears = validFaceFrames.map(f => f.face.avgEAR);
      const mars = validFaceFrames.map(f => f.face.mar);
      const yaws = validFaceFrames.map(f => f.face.yaw);
      const pitches = validFaceFrames.map(f => f.face.pitch);
      const rolls = validFaceFrames.map(f => f.face.roll);

      stats.face = {
        eyeAspectRatio: {
          mean: average(ears),
          std: standardDeviation(ears),
          min: Math.min(...ears),
          max: Math.max(...ears),
        },
        mouthAspectRatio: {
          mean: average(mars),
          std: standardDeviation(mars),
          min: Math.min(...mars),
          max: Math.max(...mars),
        },
        yaw: {
          mean: average(yaws),
          std: standardDeviation(yaws),
          min: Math.min(...yaws),
          max: Math.max(...yaws),
        },
        pitch: {
          mean: average(pitches),
          std: standardDeviation(pitches),
          min: Math.min(...pitches),
          max: Math.max(...pitches),
        },
        roll: {
          mean: average(rolls),
          std: standardDeviation(rolls),
          min: Math.min(...rolls),
          max: Math.max(...rolls),
        },
      };
    }

    return stats;
  };

  // Helper functions
  const average = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const standardDeviation = (arr) => {
    const avg = average(arr);
    const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(average(squareDiffs));
  };

  // Export analysis results
  const exportResults = () => {
    const data = JSON.stringify(analysisResults, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediapipe_analysis_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Analysis exported!');
  };

  // Generate reference values from good examples
  const generateReferenceValues = () => {
    const goodExamples = analysisResults.filter(r => r.quality === 'good');
    
    if (goodExamples.length === 0) {
      toast.warning('No good examples to generate reference values from');
      return;
    }

    const referenceValues = {
      generatedAt: new Date().toISOString(),
      basedOn: goodExamples.length,
      categories: {},
    };

    // Group by category
    const categories = [...new Set(goodExamples.map(e => e.category))];
    
    categories.forEach(cat => {
      const catExamples = goodExamples.filter(e => e.category === cat);
      
      referenceValues.categories[cat] = {
        sampleCount: catExamples.length,
        pose: {},
        face: {},
      };

      // Aggregate pose metrics
      const poseMetrics = ['shoulderSlope', 'headTilt', 'headForward'];
      poseMetrics.forEach(metric => {
        const means = catExamples.filter(e => e.pose[metric]).map(e => e.pose[metric].mean);
        if (means.length > 0) {
          referenceValues.categories[cat].pose[metric] = {
            idealMean: average(means),
            toleranceStd: standardDeviation(means),
          };
        }
      });

      // Aggregate face metrics
      const faceMetrics = ['eyeAspectRatio', 'mouthAspectRatio', 'yaw', 'pitch', 'roll'];
      faceMetrics.forEach(metric => {
        const means = catExamples.filter(e => e.face[metric]).map(e => e.face[metric].mean);
        if (means.length > 0) {
          referenceValues.categories[cat].face[metric] = {
            idealMean: average(means),
            toleranceStd: standardDeviation(means),
          };
        }
      });
    });

    const data = JSON.stringify(referenceValues, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediapipe_reference_values_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Reference values generated!');
  };

  return (
    <div className="space-y-6">
      {/* Initialization */}
      {!isInitialized && (
        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg text-center">
          <Icon name="Cpu" className="w-12 h-12 mx-auto mb-4 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
            Initialize MediaPipe
          </h3>
          <p className="text-gray-600 dark:text-slate-400 mb-4">
            Load the MediaPipe models to analyze videos
          </p>
          <Button onClick={initializeMediaPipe}>
            <Icon name="Play" className="w-4 h-4 mr-2" />
            Initialize
          </Button>
        </div>
      )}

      {/* Main Interface */}
      {isInitialized && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recordings List */}
          <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 shadow-lg">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">
              Recorded Videos ({recordings.length})
            </h3>
            
            {recordings.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                <Icon name="Video" className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recordings available</p>
                <p className="text-xs mt-1">Record videos in the Video Recorder tab</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recordings.map((recording) => {
                  const hasAnalysis = analysisResults.some(a => a.recordingId === recording.id);
                  return (
                    <button
                      key={recording.id}
                      onClick={() => analyzeVideo(recording)}
                      disabled={isAnalyzing}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedRecording?.id === recording.id
                          ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300'
                          : 'bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900'
                      } border`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-6 rounded ${recording.quality === 'good' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div>
                            <div className="font-medium text-sm text-gray-900 dark:text-slate-100">
                              {recording.category}
                            </div>
                            <div className="text-xs text-gray-500">
                              {recording.description || recording.quality}
                            </div>
                          </div>
                        </div>
                        {hasAnalysis && (
                          <Icon name="CheckCircle" className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Analysis View */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video Player (hidden) */}
            <video ref={videoRef} className="hidden" crossOrigin="anonymous" />
            <canvas ref={canvasRef} className="hidden" />

            {/* Progress */}
            {isAnalyzing && (
              <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    Analyzing video...
                  </span>
                  <span className="text-sm text-gray-500">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Current Analysis Results */}
            {currentAnalysis && !isAnalyzing && (
              <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
                <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">
                  Analysis Results: {currentAnalysis.category} ({currentAnalysis.quality})
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <div className="text-xs text-gray-500 mb-1">Total Frames</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-slate-100">
                      {currentAnalysis.totalFrames}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <div className="text-xs text-gray-500 mb-1">Valid Detections</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-slate-100">
                      {currentAnalysis.validPoseFrames} / {currentAnalysis.validFaceFrames}
                    </div>
                  </div>
                </div>

                {/* Pose Metrics */}
                {currentAnalysis.pose && Object.keys(currentAnalysis.pose).length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Pose Metrics
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(currentAnalysis.pose).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-slate-400">{key}</span>
                          <span className="text-gray-900 dark:text-slate-100 font-mono">
                            μ={value.mean.toFixed(4)} σ={value.std.toFixed(4)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Face Metrics */}
                {currentAnalysis.face && Object.keys(currentAnalysis.face).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Face Metrics
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(currentAnalysis.face).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-slate-400">{key}</span>
                          <span className="text-gray-900 dark:text-slate-100 font-mono">
                            μ={value.mean.toFixed(4)} σ={value.std.toFixed(4)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Export Options */}
            <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">
                Export & Generate
              </h3>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={exportResults}
                  disabled={analysisResults.length === 0}
                >
                  <Icon name="Download" className="w-4 h-4 mr-2" />
                  Export All Analysis ({analysisResults.length})
                </Button>
                <Button
                  variant="primary"
                  onClick={generateReferenceValues}
                  disabled={analysisResults.filter(r => r.quality === 'good').length === 0}
                >
                  <Icon name="Sparkles" className="w-4 h-4 mr-2" />
                  Generate Reference Values
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                Reference values are generated from "good" examples only
              </p>
            </div>

            {/* Summary Stats */}
            {analysisResults.length > 0 && (
              <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
                <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">
                  Analysis Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {analysisResults.filter(r => r.quality === 'good').length}
                    </div>
                    <div className="text-xs text-gray-500">Good Examples</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {analysisResults.filter(r => r.quality === 'bad').length}
                    </div>
                    <div className="text-xs text-gray-500">Bad Examples</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {[...new Set(analysisResults.map(r => r.category))].length}
                    </div>
                    <div className="text-xs text-gray-500">Categories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {analysisResults.reduce((sum, r) => sum + r.totalFrames, 0)}
                    </div>
                    <div className="text-xs text-gray-500">Total Frames</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoAnalyzer;
