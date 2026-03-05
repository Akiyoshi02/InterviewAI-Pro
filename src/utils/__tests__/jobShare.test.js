import { describe, expect, it } from 'vitest';
import { buildJobShareCardUrl, buildJobSharePackage, prepareJobShareAttachments } from '../jobShare.js';

describe('buildJobSharePackage', () => {
  it('builds a public share-card URL for social previews', () => {
    const url = buildJobShareCardUrl('abc123', { apiBaseUrl: 'https://api.example.com/' });
    expect(url).toBe('https://api.example.com/api/public/jobs/abc123/share');
  });

  it('supports cache-busting token in share-card URL', () => {
    const url = buildJobShareCardUrl('abc123', {
      apiBaseUrl: 'https://api.example.com/',
      version: '2026-03-03T10:00:00.000Z',
    });
    expect(url).toBe('https://api.example.com/api/public/jobs/abc123/share?v=2026-03-03T10%3A00%3A00.000Z');
  });

  it('includes media links and professional share formatting', () => {
    const payload = buildJobSharePackage(
      {
        title: 'Senior Frontend Engineer',
        department: 'Engineering',
        employmentType: 'FULL_TIME',
        experienceLevel: 'SENIOR',
        location: 'Remote',
        description: 'Build product experiences across web platforms.',
        skills: ['React', 'TypeScript', 'Testing'],
        requirements: ['5+ years experience', 'Strong system design'],
        responsibilities: ['Own feature delivery', 'Mentor junior engineers'],
        advertImageUrls: ['/uploads/job-advert-images/img-1.png'],
        advertVideoUrl: '/uploads/job-advert-videos/intro.mp4',
      },
      {
        organizationName: 'InterviewAI',
        jobUrl: 'https://example.com/jobs/abc123',
        shareUrl: 'https://api.example.com/api/public/jobs/abc123/share',
        apiBaseUrl: 'https://api.example.com',
      },
    );

    expect(payload.title).toBe('Senior Frontend Engineer');
    expect(payload.summaryText).toContain('InterviewAI');
    expect(payload.hasMedia).toBe(true);
    expect(payload.media.imageUrls[0]).toBe('https://api.example.com/uploads/job-advert-images/img-1.png');
    expect(payload.media.videoUrl).toBe('https://api.example.com/uploads/job-advert-videos/intro.mp4');
    expect(payload.detailedText).toContain('Key Skills');
    expect(payload.detailedText).toContain('- React');
    expect(payload.detailedText).toContain('Project Media');
    expect(payload.detailedText).toContain('- Image 1: https://api.example.com/uploads/job-advert-images/img-1.png');
    expect(payload.detailedText).toContain('- Video: https://api.example.com/uploads/job-advert-videos/intro.mp4');
    expect(payload.detailedText).toContain('View Job\nhttps://api.example.com/api/public/jobs/abc123/share');
    expect(payload.detailedText).toContain('Apply Directly\nhttps://example.com/jobs/abc123');
    expect(payload.whatsappText).toContain('*Senior Frontend Engineer*');
    expect(payload.whatsappText).toContain('*View Job & Apply*');
    expect(payload.whatsappText).not.toContain('Image 1:');
    expect(payload.whatsappCaptionText).toContain('Overview');
    expect(payload.whatsappCaptionText).toContain('Key Skills');
    expect(payload.whatsappCaptionText).toContain('View Job\nhttps://api.example.com/api/public/jobs/abc123/share');
    expect(payload.whatsappCaptionText).not.toContain('Project Media');
    expect(payload.whatsappCaptionText.length).toBeLessThanOrEqual(880);
    expect(payload.nativeShareText).not.toContain('Apply Here');
  });

  it('sanitizes requirements stored as quoted string arrays', () => {
    const payload = buildJobSharePackage(
      {
        title: 'Frontend Engineer',
        requirements: '["5+ years of frontend engineering experience with React","Strong TypeScript and modern JavaScript fundamentals"]',
      },
      {
        organizationName: 'Acme',
        jobUrl: 'https://example.com/jobs/2',
      },
    );

    expect(payload.detailedText).toContain('Requirements');
    expect(payload.detailedText).toContain('- 5+ years of frontend engineering experience with React');
    expect(payload.detailedText).toContain('- Strong TypeScript and modern JavaScript fundamentals');
    expect(payload.detailedText).not.toContain('"5+ years');
  });

  it('handles jobs without media gracefully', () => {
    const payload = buildJobSharePackage(
      {
        title: 'Data Analyst',
        description: 'Analyze trends.',
      },
      {
        organizationName: 'Acme',
        jobUrl: 'https://example.com/jobs/1',
      },
    );

    expect(payload.hasMedia).toBe(false);
    expect(payload.media.imageUrls).toEqual([]);
    expect(payload.media.videoUrl).toBe('');
    expect(payload.detailedText).not.toContain('Project Media');
    expect(payload.detailedText).toContain('View Job\nhttps://example.com/jobs/1');
  });

  it('prepares media attachments for native share when assets are reachable', async () => {
    if (typeof File === 'undefined') {
      expect(true).toBe(true);
      return;
    }

    const fetchMock = async (url) => {
      if (String(url).includes('.png')) {
        return {
          ok: true,
          blob: async () => new Blob(['image-bytes'], { type: 'image/png' }),
        };
      }
      if (String(url).includes('.mp4')) {
        return {
          ok: true,
          blob: async () => new Blob(['video-bytes'], { type: 'video/mp4' }),
        };
      }
      return { ok: false, blob: async () => new Blob([]) };
    };

    const result = await prepareJobShareAttachments(
      {
        advertImageUrls: ['/uploads/job-advert-images/sample.png'],
        advertVideoUrl: '/uploads/job-advert-videos/intro.mp4',
      },
      {
        apiBaseUrl: 'https://api.example.com',
        fetchImpl: fetchMock,
      },
    );

    expect(result.files.length).toBe(2);
    expect(result.attachedImageCount).toBe(1);
    expect(result.attachedVideo).toBe(true);
    expect(result.files[0].name).toContain('.png');
    expect(result.files[1].name).toContain('.mp4');
  });
});
