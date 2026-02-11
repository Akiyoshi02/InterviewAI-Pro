import logger from '../utils/logger.js';
import { verifyFirebaseToken } from '../config/firebase.js';
import {
  interviewStore,
  recordRealtimeEvent,
  savePoseData,
  syncRealtimeInterviewSession,
  userStore,
} from '../services/firebaseData.service.js';

export function setupSocketIO(io) {
  io.use(async (socket, next) => {
    try {
      const authPayload = socket.handshake?.auth || {};

      // Verify authentication token from handshake
      const token = authPayload.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const interviewId = typeof authPayload.interviewId === 'string'
        ? authPayload.interviewId.trim()
        : '';
      if (!interviewId) {
        return next(new Error('Authentication error: Missing interview ID'));
      }

      // Verify Firebase token
      const userData = await verifyFirebaseToken(token);
      if (!userData) {
        return next(new Error('Authentication error: Invalid token'));
      }

      const user = await userStore.getByUid(userData.uid);

      if (!user || !user.id) {
        return next(new Error('Authentication error: User not found'));
      }

      const interview = await interviewStore.getById(interviewId);
      if (!interview) {
        return next(new Error('Authentication error: Interview not found'));
      }

      const isParticipant = interview.candidateId === user.id || interview.companyId === user.id;
      if (!isParticipant) {
        return next(new Error('Authentication error: Interview access denied'));
      }

      try {
        await syncRealtimeInterviewSession(interview);
      } catch (syncError) {
        logger.warn(`Failed to sync realtime session during socket auth for interview ${interview.id}:`, syncError);
      }

      socket.userId = user.id;
      socket.interviewId = interview.id;
      socket.userRole = interview.candidateId === user.id ? 'candidate' : 'company';
      socket.firebaseUid = userData.uid;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(
      `Client connected: ${socket.id}, User: ${socket.userId}, Interview: ${socket.interviewId}, Role: ${socket.userRole}`,
    );

    const roomId = `interview-${socket.interviewId}`;
    socket.join(roomId);

    void recordRealtimeEvent(socket.interviewId, 'participant-connected', {
      actor: socket.userId,
      role: socket.userRole,
      socketId: socket.id,
    });

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
        const questionId = typeof data?.questionId === 'string' ? data.questionId.trim() : '';
        if (!questionId) {
          logger.warn(`Missing questionId in interview:question-asked from socket ${socket.id}`);
          return;
        }

        const askedAt = new Date().toISOString();

        await interviewStore.updateQuestion(socket.interviewId, questionId, {
          askedAt,
        });

        await recordRealtimeEvent(socket.interviewId, 'question-asked', {
          questionId,
          actor: socket.userId,
          askedAt,
        });

        io.to(roomId).emit('interview:question-asked', {
          ...data,
          questionId,
          askedAt,
          actor: socket.userId,
        });
      } catch (error) {
        logger.error('Question asked event error:', error);
      }
    });

    socket.on('interview:answer-submitted', async (data) => {
      try {
        const questionId = typeof data?.questionId === 'string' ? data.questionId.trim() : '';
        if (!questionId) {
          logger.warn(`Missing questionId in interview:answer-submitted from socket ${socket.id}`);
          return;
        }

        const answer = typeof data?.answer === 'string' ? data.answer : '';
        const answeredAt = new Date().toISOString();

        await interviewStore.updateQuestion(socket.interviewId, questionId, {
          answer,
          answeredAt,
        });

        await recordRealtimeEvent(socket.interviewId, 'answer-submitted', {
          questionId,
          actor: socket.userId,
          answeredAt,
        });

        io.to(roomId).emit('interview:answer-submitted', {
          ...data,
          questionId,
          answer,
          answeredAt,
          actor: socket.userId,
        });
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
      void recordRealtimeEvent(socket.interviewId, 'participant-disconnected', {
        actor: socket.userId,
        role: socket.userRole,
        socketId: socket.id,
      });
    });
  });

  logger.info('Socket.IO setup complete');
}
