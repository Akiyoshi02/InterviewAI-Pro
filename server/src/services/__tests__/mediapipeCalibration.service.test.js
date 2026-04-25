import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockAnalyticsGet = jest.fn();
const mockInterviewsGet = jest.fn();
const mockCollection = jest.fn((name) => {
  if (name === 'trainingDatasets_analytics') {
    return {
      limit: jest.fn(() => ({
        get: mockAnalyticsGet,
      })),
    };
  }

  if (name === 'interviews') {
    return {
      where: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: mockInterviewsGet,
        })),
      })),
    };
  }

  throw new Error(`Unexpected collection: ${name}`);
});

jest.unstable_mockModule('../../config/firebase.js', () => ({
  firestore: {
    collection: mockCollection,
  },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const { calibrateFromCollectedData } = await import('../mediapipeCalibration.service.js');

const buildAnalyticsDoc = (id, overrides = {}) => ({
  id,
  data: () => ({
    summary: {
      averageOverallScore: 84,
    },
    data: {
      dataPoints: [
        {
          scores: {
            posture: 82,
          },
          bodyLanguage: {
            handMovement: 0.02,
          },
          faceSummary: {
            orientation: {
              yaw: 4.5,
              pitch: 2.4,
            },
            eyes: {
              avgEAR: 0.27,
              asymmetry: 0.02,
            },
            gaze: {
              deviation: 0.08,
              horizontalOffset: 0.03,
              verticalOffset: 0.02,
            },
            iris: {
              symmetry: 0.03,
            },
            speaking: {
              mouthMAR: 0.11,
            },
          },
        },
        {
          scores: {
            posture: 80,
          },
          bodyLanguage: {
            handMovement: 0.03,
          },
          faceSummary: {
            orientation: {
              yaw: 5.7,
              pitch: 3.1,
            },
            eyes: {
              avgEAR: 0.28,
              asymmetry: 0.03,
            },
            gaze: {
              deviation: 0.1,
              horizontalOffset: 0.05,
              verticalOffset: 0.04,
            },
            iris: {
              symmetry: 0.04,
            },
            speaking: {
              mouthMAR: 0.12,
            },
          },
        },
      ],
    },
    ...overrides,
  }),
});

describe('mediapipeCalibration.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyticsGet.mockResolvedValue({
      docs: [
        buildAnalyticsDoc('analytics-1'),
        buildAnalyticsDoc('analytics-2', {
          data: {
            dataPoints: [
              {
                scores: { posture: 85 },
                bodyLanguage: { handMovement: 0.018 },
                faceSummary: {
                  orientation: { yaw: 3.9, pitch: 1.9 },
                  eyes: { avgEAR: 0.29, asymmetry: 0.018 },
                  gaze: {
                    deviation: 0.07,
                    horizontalOffset: 0.025,
                    verticalOffset: 0.018,
                  },
                  iris: { symmetry: 0.025 },
                  speaking: { mouthMAR: 0.1 },
                },
              },
            ],
          },
        }),
      ],
    });
    mockInterviewsGet.mockResolvedValue({ docs: [] });
  });

  it('derives advanced gaze and iris calibration thresholds from collected analytics data', async () => {
    const result = await calibrateFromCollectedData();

    expect(result.success).toBe(true);
    expect(result.summary.highScoreDatasets).toBeGreaterThan(0);

    const horizontalOffsetComparison = result.comparisons.find(
      (entry) => entry.metric === 'eyeContact.gaze.horizontalOffsetThreshold',
    );
    const irisSymmetryComparison = result.comparisons.find(
      (entry) => entry.metric === 'eyeContact.gaze.irisSymmetryThreshold',
    );

    expect(horizontalOffsetComparison).toEqual(expect.objectContaining({
      confidence: expect.any(String),
      stats: expect.objectContaining({
        sampleSize: expect.any(Number),
      }),
    }));
    expect(irisSymmetryComparison).toEqual(expect.objectContaining({
      confidence: expect.any(String),
      stats: expect.objectContaining({
        sampleSize: expect.any(Number),
      }),
    }));

    expect(result.calibrated.eyeContact.gaze.horizontalOffsetThreshold).toBeGreaterThan(0);
    expect(result.calibrated.eyeContact.gaze.irisSymmetryThreshold).toBeGreaterThan(0);
  });
});
