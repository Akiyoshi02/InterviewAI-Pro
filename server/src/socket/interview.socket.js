import logger from '../utils/logger.js';
import { verifyFirebaseToken } from '../config/firebase.js';
import {
  interviewStore,
  recordRealtimeEvent,
  savePoseData,
  userStore,
} from '../services/firebaseData.service.js';

export function setupSocketIO(io) {
  io.use(async (socket, next) => {
    try {
      // Verify authentication token from handshake
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify Firebase token
      const userData = await verifyFirebaseToken(token);
      if (!userData) {
        return next(new Error('Authentication error: Invalid token'));
      }

      const userId = socket.handshake.auth.userId;
      const interviewId = socket.handshake.auth.interviewId;

      if (!userId || !interviewId) {
        return next(new Error('Authentication error: Missing user or interview ID'));
      }

      const user = await userStore.getByUid(userData.uid);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = userId;
      socket.interviewId = interviewId;
      socket.firebaseUid = userData.uid;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}, User: ${socket.userId}, Interview: ${socket.interviewId}`);

    const roomId = `interview-${socket.interviewId}`;
    socket.join(roomId);

    // WebRTC Signaling
    socket.on('webrtc:offer', async (data) => {
      socket.to(roomId).emit('webrtc:offer', {
        offer: data.offer,
        from: socket.id,
      });
    });

    socket.on('webrtc:answer', async (data) => {
      socket.to(roomId).emit('webrtc:answer', {
        answer: data.answer,
        from: socket.id,
      });
    });

    socket.on('webrtc:ice-candidate', async (data) => {
      socket.to(roomId).emit('webrtc:ice-candidate', {
        candidate: data.candidate,
        from: socket.id,
      });
    });

    // Interview session events
    socket.on('interview:question-asked', async (data) => {
      try {
        await interviewStore.updateQuestion(socket.interviewId, data.questionId, {
          askedAt: new Date().toISOString(),
        });

        await recordRealtimeEvent(socket.interviewId, 'question-asked', {
          questionId: data.questionId,
          actor: socket.userId,
        });

        io.to(roomId).emit('interview:question-asked', data);
      } catch (error) {
        logger.error('Question asked event error:', error);
      }
    });

    socket.on('interview:answer-submitted', async (data) => {
      try {
        await interviewStore.updateQuestion(socket.interviewId, data.questionId, {
          answer: data.answer,
          answeredAt: new Date().toISOString(),
        });

        await recordRealtimeEvent(socket.interviewId, 'answer-submitted', {
          questionId: data.questionId,
          actor: socket.userId,
        });

        io.to(roomId).emit('interview:answer-submitted', data);
      } catch (error) {
        logger.error('Answer submitted event error:', error);
      }
    });

    // Audio transcription (streaming chunks)
    socket.on('audio:chunk', async (data) => {
      // Process audio chunk with Whisper API
      // This will be handled by a service
      socket.to(roomId).emit('transcription:update', {
        text: 'Processing...', // Placeholder
        timestamp: new Date(),
      });
    });

    // Pose data from MediaPipe
    socket.on('pose:data', async (data) => {
      try {
        await savePoseData(socket.interviewId, data);
        await recordRealtimeEvent(socket.interviewId, 'pose-data', {
          actor: socket.userId,
          engagementScore: data.engagementScore,
          postureQuality: data.postureQuality,
        });
      } catch (error) {
        logger.error('Pose data save error:', error);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  logger.info('Socket.IO setup complete');
}
