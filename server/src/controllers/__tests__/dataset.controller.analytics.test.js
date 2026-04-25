import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockAdd = jest.fn();
const mockSet = jest.fn();
const mockPublishAdminRealtimeUpdate = jest.fn();

jest.unstable_mockModule('../../config/firebase.js', () => ({
  firestore: {
    collection: jest.fn((name) => {
      if (name === 'trainingDatasets_analytics') {
        return { add: mockAdd };
      }
      if (name === 'trainingDatasets_metadata') {
        return { doc: () => ({ set: mockSet }) };
      }
      return { add: mockAdd, doc: () => ({ set: mockSet }) };
    }),
  },
}));

jest.unstable_mockModule('../../services/firebaseData.service.js', () => ({
  publishAdminRealtimeUpdate: mockPublishAdminRealtimeUpdate,
}));

const { saveAnalyticsDataset } = await import('../dataset.controller.js');

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('saveAnalyticsDataset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdd.mockResolvedValue({ id: 'dataset-1' });
    mockSet.mockResolvedValue(undefined);
    mockPublishAdminRealtimeUpdate.mockResolvedValue(undefined);
  });

  it('samples and compacts oversized analytics payloads before persisting', async () => {
    const dataPoints = Array.from({ length: 500 }, (_, index) => ({
      timestamp: index * 100,
      frameNumber: index,
      pose: { landmarks: Array.from({ length: 50 }, () => ({ x: 1, y: 2, z: 3 })) },
      face: {
        landmarks: Array.from({ length: 50 }, () => ({ x: 4, y: 5, z: 6 })),
        eyeContactScore: 81,
        yaw: 5,
        pitch: 4,
        roll: 2,
        faceOrientationStatus: 'direct',
        blinkCount: 3,
        blinkRate: 16,
        avgEAR: 0.25,
        eyeAsymmetry: 0.04,
        gaze: {
          direction: 'center',
          status: 'direct',
          deviation: 0.07,
          horizontalOffset: 0.01,
          verticalOffset: -0.01,
          isLookingAtCamera: true,
        },
        iris: {
          left: { rawX: 0.4, rawY: 0.5, normalizedX: 0.51, normalizedY: 0.48 },
          right: { rawX: 0.6, rawY: 0.5, normalizedX: 0.49, normalizedY: 0.5 },
          symmetry: 0.03,
        },
        mouthMAR: 0.1,
        isSpeaking: true,
      },
      bodyLanguage: {
        posture: index % 2 === 0 ? 'good' : 'neutral',
        eyeContact: 'good',
        headPosition: 'level',
        handMovement: 'controlled',
      },
      scores: {
        posture: 80,
        attention: 75,
        bodyLanguage: 78,
        overall: 79,
      },
    }));

    const req = {
      user: { uid: 'candidate-1' },
      body: {
        sessionId: 'session-1',
        interviewId: 'int-1',
        dataPoints,
        summary: { totalFrames: dataPoints.length },
        config: { enablePose: true, enableFace: true, detectionInterval: 100 },
      },
    };
    const res = createResponse();

    await saveAnalyticsDataset(req, res);

    expect(mockAdd).toHaveBeenCalledTimes(1);
    const savedDataset = mockAdd.mock.calls[0][0];
    expect(savedDataset.data.totalFrames).toBe(500);
    expect(savedDataset.data.storedFrames).toBeLessThanOrEqual(180);
    expect(savedDataset.data.wasSampled).toBe(true);
    expect(savedDataset.data.dataPoints[0]).toEqual(expect.objectContaining({
      timestamp: expect.any(Number),
      frameNumber: expect.any(Number),
      scores: expect.objectContaining({ overall: 79 }),
      bodyLanguage: expect.objectContaining({ posture: expect.any(String) }),
      signals: expect.objectContaining({
        poseDetected: true,
        faceDetected: true,
      }),
    }));
    expect(savedDataset.data.dataPoints[0].pose).toBeUndefined();
    expect(savedDataset.data.dataPoints[0].face).toBeUndefined();
    expect(savedDataset.data.dataPoints[0].faceSummary).toEqual(expect.objectContaining({
      eyeContactScore: 81,
      gaze: expect.objectContaining({
        direction: 'center',
        deviation: 0.07,
        isLookingAtCamera: true,
      }),
      iris: expect.objectContaining({
        symmetry: 0.03,
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

