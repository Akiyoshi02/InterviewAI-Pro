import { describe, expect, it } from 'vitest';
import { shouldHideOnRoute } from '../LiveChatWidget.jsx';

describe('shouldHideOnRoute', () => {
  it('hides live chat on public auth routes including team invite acceptance', () => {
    expect(shouldHideOnRoute('/login')).toBe(true);
    expect(shouldHideOnRoute('/register')).toBe(true);
    expect(shouldHideOnRoute('/accept-team-invite/token-123')).toBe(true);
  });

  it('keeps live chat available on non-auth public routes', () => {
    expect(shouldHideOnRoute('/')).toBe(false);
    expect(shouldHideOnRoute('/about')).toBe(false);
    expect(shouldHideOnRoute('/jobs/devops-engineer')).toBe(false);
  });
});
