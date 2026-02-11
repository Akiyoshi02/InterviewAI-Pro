import {
  activityLogStore,
  invitationStore,
  interviewStore,
  jobStore,
  publishCandidateRealtimeUpdate,
  publishOrganizationRealtimeUpdate,
  recordRealtimeEvent,
  userStore,
} from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

const summarizeCandidate = (interview) => ({
  interviewId: interview.id,
  candidateId: interview.candidateId,
  jobId: interview.jobId,
  invitationId: interview.invitationId,
  jobStage: interview.jobStage,
  pipelineStatus: interview.pipelineStatus,
  status: interview.status,
  overallScore: interview.overallScore,
  readinessLevel: interview.readinessLevel,
  updatedAt: interview.updatedAt,
});

export class PipelineController {
  static async getPipeline(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      if (!organizationId) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const [interviews, jobs, invitations] = await Promise.all([
        interviewStore.listByOrganization(organizationId),
        jobStore.listByOrganization(organizationId),
        invitationStore.listByOrganization(organizationId),
      ]);

      const candidateSummaries = await userStore.getSummaries(
        interviews.map((interview) => interview.candidateId).filter(Boolean),
      );

      const jobsMap = new Map(jobs.map((job) => [job.id, job]));
      const invitationsMap = new Map(invitations.map((invite) => [invite.id, invite]));

      const pipeline = interviews.map((interview) => ({
        ...summarizeCandidate(interview),
        candidate: interview.candidateId ? candidateSummaries.get(interview.candidateId) || null : null,
        job: interview.jobId ? jobsMap.get(interview.jobId) || null : null,
        invitation: interview.invitationId ? invitationsMap.get(interview.invitationId) || null : null,
      }));

      res.json({ success: true, pipeline });
    } catch (error) {
      logger.error('Get pipeline error:', error);
      next(error);
    }
  }

  static async moveCandidate(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const { interviewId } = req.params;
      const { jobStage, pipelineStatus, status } = req.body;

      const interview = await interviewStore.getById(interviewId);
      if (!interview || interview.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      const updated = await interviewStore.update(interviewId, {
        jobStage: jobStage ?? interview.jobStage,
        pipelineStatus: pipelineStatus
          ? pipelineStatus.toUpperCase()
          : interview.pipelineStatus,
        status: status || interview.status,
      });

      await activityLogStore.record({
        organizationId,
        actorId: req.user.id,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'PIPELINE_MOVED',
        targetType: 'INTERVIEW',
        targetId: updated.id,
        metadata: {
          jobStage: updated.jobStage,
          pipelineStatus: updated.pipelineStatus,
        },
      });

      try {
        await recordRealtimeEvent(updated.id, 'pipeline-updated', {
          actor: req.user.id,
          status: updated.status || null,
          jobStage: updated.jobStage || null,
          pipelineStatus: updated.pipelineStatus || null,
        });
      } catch (eventError) {
        logger.warn(`Failed to publish pipeline-updated realtime event for interview ${updated.id}:`, eventError);
      }

      await publishOrganizationRealtimeUpdate(organizationId, 'pipeline-updated', {
        interviewId: updated.id,
        candidateId: updated.candidateId || null,
        pipelineStatus: updated.pipelineStatus || null,
        jobStage: updated.jobStage || null,
      });
      await publishCandidateRealtimeUpdate(updated.candidateId, 'pipeline-updated', {
        interviewId: updated.id,
        organizationId,
        pipelineStatus: updated.pipelineStatus || null,
        jobStage: updated.jobStage || null,
      });

      res.json({ success: true, interview: updated });
    } catch (error) {
      logger.error('Move candidate error:', error);
      next(error);
    }
  }
}

