import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { InterviewController } from '../interview.controller.js';
import { interviewStore, userStore } from '../../services/firebaseData.service.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('InterviewController score leaderboard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns ranked candidate score leaderboard from completed scored interviews', async () => {
    jest.spyOn(interviewStore, 'listCompletedScoredForLeaderboard').mockResolvedValue([
      { id: 'iv-1', candidateId: 'candidate-1', overallScore: 92, completedAt: '2026-03-02T10:00:00.000Z' },
      { id: 'iv-2', candidateId: 'candidate-1', overallScore: 88, completedAt: '2026-03-04T10:00:00.000Z' },
      { id: 'iv-3', candidateId: 'candidate-2', overallScore: 90, completedAt: '2026-03-03T10:00:00.000Z' },
    ]);
    jest.spyOn(userStore, 'getSummaries').mockResolvedValue(new Map([
      ['candidate-1', { id: 'candidate-1', fullName: 'Akiyoshi Hikaru Yapa', email: 'aki@example.com', profilePhotoUrl: null }],
      ['candidate-2', { id: 'candidate-2', fullName: 'Chris Doe', email: 'chris@example.com', profilePhotoUrl: null }],
    ]));

    const req = {
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.getScoreLeaderboard(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      leaderboard: [
        expect.objectContaining({
          rank: 1,
          userId: 'candidate-1',
          displayName: 'Akiyoshi Y.',
          averageScore: 90,
          bestScore: 92,
          scoredInterviews: 2,
        }),
        expect.objectContaining({
          rank: 2,
          userId: 'candidate-2',
          displayName: 'Chris D.',
          averageScore: 90,
          bestScore: 90,
          scoredInterviews: 1,
        }),
      ],
    });
    expect(next).not.toHaveBeenCalled();
  });
});
