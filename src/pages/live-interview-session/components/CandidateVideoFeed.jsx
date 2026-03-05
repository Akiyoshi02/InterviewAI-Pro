import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';
import useInterviewAnalytics from '../../../hooks/useInterviewAnalytics';
import LoadingIndicator from '../../../components/ui/LoadingIndicator';

const CandidateVideoFeed = ({ 
  isVideoEnabled = true,
  isAudioEnabled = true,
  onToggleVideo,
  onToggleAudio,
  onPoseMetricsUpdate,
  onMediaStreamReady,
  enablePoseDetection = true,
  interviewId = null,
  analyticsDataRef = null,
  className = ''
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const lastPoseUpdateRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const analyticsOptions = useMemo(() => ({
    enablePose: enablePoseDetection && isVideoEnabled,
    enableFace: enablePoseDetection && isVideoEnabled,
    collectData: true,
    interviewId,
  }), [enablePoseDetection, isVideoEnabled, interviewId]);

  // Initialize comprehensive interview analytics (pose + face-mesh)
  const { 
    isInitialized: isPoseInitialized,
    error: poseError,
    poseMetrics,
    metrics: fullMetrics,
    isPoseReady,
    isFaceReady,
    collectedData,
  } = useInterviewAnalytics(videoRef, analyticsOptions);

  useEffect(() => {
    if (analyticsDataRef && collectedData) {
      analyticsDataRef.current = { collectedData, interviewId };
    }
  }, [analyticsDataRef, collectedData, interviewId]);
  
  const poseEnabled = isPoseReady || isFaceReady;

  const safePlay = useCallback((videoElement) => {
    if (!videoElement) return;
    const playPromise = videoElement.play?.();
    if (playPromise?.catch) {
      playPromise.catch((error) => {
        if (error?.name !== 'AbortError') {
          console.warn('Unable to auto-play candidate camera feed:', error);
        }
      });
    }
  }, []);

  // Initialize camera once on mount
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        setIsLoading(true);
        const mediaStream = await navigator.mediaDevices?.getUserMedia({
          video: true,
          audio: true
        });
        streamRef.current = mediaStream;
        setStream(mediaStream);
        onMediaStreamReady?.(mediaStream);
        
        // Wait for video ref to be available
        if (videoRef?.current) {
          videoRef.current.srcObject = mediaStream;
          safePlay(videoRef.current);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error accessing camera:', error);
        setIsLoading(false);
      }
    };

    initializeCamera();

    return () => {
      onMediaStreamReady?.(null);
      if (streamRef.current) {
        streamRef.current.getTracks()?.forEach(track => track?.stop());
        streamRef.current = null;
      }
    };
  }, []); // Empty dependency array - initialize only once

  // Update video ref when stream changes
  useEffect(() => {
    if (stream && videoRef?.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
      safePlay(videoRef.current);
    }
  }, [stream, safePlay]);

  // Sync audio track with isAudioEnabled prop
  useEffect(() => {
    if (stream) {
      const audioTrack = stream?.getAudioTracks()?.[0];
      if (audioTrack) {
        audioTrack.enabled = isAudioEnabled;
      }
    }
  }, [stream, isAudioEnabled]);

  // Sync video track with isVideoEnabled prop
  useEffect(() => {
    if (stream) {
      const videoTrack = stream?.getVideoTracks()?.[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoEnabled;
        
        // Ensure video element refreshes when track is re-enabled
        if (isVideoEnabled && videoRef?.current) {
          // Force video to refresh by reassigning srcObject
          videoRef.current.srcObject = stream;
          safePlay(videoRef.current);
        }
      }
    }
  }, [stream, isVideoEnabled, safePlay]);

  // Update parent component with pose metrics and full analytics
  useEffect(() => {
    if (!poseMetrics || !onPoseMetricsUpdate) return;

    const poseUpdateKey = `${poseMetrics.lastUpdated ?? 0}:${poseMetrics.confidence ?? 0}:${poseMetrics.postureScore ?? 0}`;
    if (lastPoseUpdateRef.current === poseUpdateKey) return;

    lastPoseUpdateRef.current = poseUpdateKey;
    onPoseMetricsUpdate(poseMetrics, fullMetrics);
  }, [poseMetrics, fullMetrics, onPoseMetricsUpdate]);

  const handleToggleVideo = () => {
    if (stream) {
      const videoTrack = stream?.getVideoTracks()?.[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack?.enabled;
      }
    }
    onToggleVideo?.();
  };

  const handleToggleAudio = () => {
    if (stream) {
      const audioTrack = stream?.getAudioTracks()?.[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack?.enabled;
      }
    }
    onToggleAudio?.();
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 shadow-[0_25px_70px_rgba(15,23,42,0.15)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur",
        className
      )}
    >
      <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      {/* Video Feed */}
      <div className="relative aspect-video bg-gray-900 rounded-[26px] overflow-hidden m-4 border border-white/30 Shadow-inner">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <LoadingIndicator size={28} tone="primary" className="mx-auto" />
              <p className="text-xs sm:text-sm text-muted-foreground">Connecting camera...</p>
            </div>
          </div>
        ) : isVideoEnabled ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/10 border border-white/20 rounded-3xl flex items-center justify-center mx-auto">
                <Icon name="VideoOff" size={20} className="text-white sm:w-6 sm:h-6" />
              </div>
              <p className="text-xs sm:text-sm text-gray-300">Camera off</p>
            </div>
          </div>
        )}

        {/* Status Indicators */}
        <div className="absolute top-2 left-2 flex space-x-1 bg-black/70 px-2 py-1 rounded-full border border-white/30">
          <div className={cn(
            "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full",
            isVideoEnabled ? 'bg-success' : 'bg-error'
          )} />
          <div className={cn(
            "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full",
            isAudioEnabled ? 'bg-success' : 'bg-error'
          )} />
          {enablePoseDetection && (
            <div className={cn(
              "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full",
              poseEnabled && isPoseInitialized ? 'bg-blue-500' : 'bg-gray-400'
            )} title={poseEnabled ? 'Pose detection active' : 'Pose detection inactive'} />
          )}
        </div>

        {/* Recording Indicator */}
        <div className="absolute top-2 right-2">
          <div className="flex items-center space-x-1 bg-red-500/80 text-white px-2 py-1 rounded-full text-[10px] sm:text-xs font-semibold shadow-lg shadow-red-500/30">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" />
            <span>REC</span>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-3 right-3 flex space-x-1 z-10">
        <Button
          variant={isAudioEnabled ? "ghost" : "destructive"}
          size="icon"
          onClick={handleToggleAudio}
          className="w-8 h-8 sm:w-9 sm:h-9 bg-black/70 backdrop-blur-md hover:bg-black/80 border border-white/30 rounded-2xl cursor-pointer"
        >
          <Icon name={isAudioEnabled ? "Mic" : "MicOff"} size={14} className="sm:w-4 sm:h-4 text-white pointer-events-none" />
        </Button>
        
        <Button
          variant={isVideoEnabled ? "ghost" : "destructive"}
          size="icon"
          onClick={handleToggleVideo}
          className="w-8 h-8 sm:w-9 sm:h-9 bg-black/70 backdrop-blur-md hover:bg-black/80 border border-white/30 rounded-2xl cursor-pointer"
        >
          <Icon name={isVideoEnabled ? "Video" : "VideoOff"} size={14} className="sm:w-4 sm:h-4 text-white pointer-events-none" />
        </Button>
      </div>
      
      {/* Candidate Label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 sm:p-3 pointer-events-none">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center space-x-1 sm:space-x-1.5">
            <Icon name="User" size={12} className="text-white sm:w-3.5 sm:h-3.5" />
            <span className="text-[10px] sm:text-xs text-white font-medium">You</span>
          </div>
          
          {/* Audio Level Indicator */}
          {isAudioEnabled && (
            <div className="bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg border border-white/30 pointer-events-auto">
              <div className="flex items-end space-x-0.5 sm:space-x-1 h-2.5 sm:h-3">
                {[...Array(5)]?.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-0.5 sm:w-1 bg-success rounded-sm transition-all duration-100",
                      Math.random() > 0.5 ? 'h-full' : 'h-1/2'
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CandidateVideoFeed;
