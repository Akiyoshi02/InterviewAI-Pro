import { v4 as uuidv4 } from 'uuid';
import { interviewStore, webrtcStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

export class VideoController {
  static async getWebRTCConfig(req, res) {
    res.json({
      iceServers: [
        {
          urls: process.env.STUN_SERVER || 'stun:stun.l.google.com:19302',
        },
        ...(process.env.TURN_SERVER
          ? [
              {
                urls: process.env.TURN_SERVER,
                username: process.env.TURN_USERNAME,
                credential: process.env.TURN_CREDENTIAL,
              },
            ]
          : []),
      ],
    });
  }

  static async createSession(req, res, next) {
    try {
      const { interviewId } = req.params;
      const userId = req.user.id;

      const interview = await interviewStore.getById(interviewId);

      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      if (interview.candidateId !== userId && interview.companyId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Create or get existing WebRTC session
      const roomId = `interview-${interviewId}`;
      const peerId = `peer-${userId}-${uuidv4()}`;

      const session = await webrtcStore.upsertSession(interviewId, { roomId, peerId });

      res.json({
        success: true,
        session: {
          roomId,
          peerId,
          interviewId,
        },
      });
    } catch (error) {
      logger.error('Create video session error:', error);
      next(error);
    }
  }

  static async getSession(req, res, next) {
    try {
      const { interviewId } = req.params;
      const userId = req.user.id;

      const interview = await interviewStore.getById(interviewId);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      if (interview.candidateId !== userId && interview.companyId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const session = await webrtcStore.getSession(interviewId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({
        success: true,
        session: {
          roomId: session.roomId,
          peerId: session.peerId,
          isConnected: session.isConnected,
        },
      });
    } catch (error) {
      logger.error('Get video session error:', error);
      next(error);
    }
  }
}
