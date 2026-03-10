import multer from 'multer';
import { recordingFileFilter } from '../upload.middleware.js';

describe('recordingFileFilter', () => {
  it('accepts browser media recorder mime types with codec suffixes', async () => {
    const file = {
      fieldname: 'recording',
      mimetype: 'video/webm;codecs=vp9,opus',
      originalname: 'session.webm',
    };

    const result = await new Promise((resolve) => {
      recordingFileFilter({}, file, (error, accepted) => resolve({ error, accepted }));
    });

    expect(result.error).toBeNull();
    expect(result.accepted).toBe(true);
  });

  it('accepts valid recording extensions even when mime type is generic', async () => {
    const file = {
      fieldname: 'recording',
      mimetype: 'application/octet-stream',
      originalname: 'session.webm',
    };

    const result = await new Promise((resolve) => {
      recordingFileFilter({}, file, (error, accepted) => resolve({ error, accepted }));
    });

    expect(result.error).toBeNull();
    expect(result.accepted).toBe(true);
  });

  it('rejects unsupported recording types', async () => {
    const file = {
      fieldname: 'recording',
      mimetype: 'text/plain',
      originalname: 'session.txt',
    };

    const result = await new Promise((resolve) => {
      recordingFileFilter({}, file, (error, accepted) => resolve({ error, accepted }));
    });

    expect(result.accepted).toBeUndefined();
    expect(result.error).toBeInstanceOf(multer.MulterError);
    expect(result.error.message).toContain('supported audio/video format');
  });
});
