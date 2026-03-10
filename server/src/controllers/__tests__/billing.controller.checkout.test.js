import { describe, expect, it, jest } from '@jest/globals';
import { BillingController } from '../billing.controller.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('BillingController.createCheckoutSession', () => {
  it('returns 503 when Stripe billing is not configured', async () => {
    const req = {
      body: { planId: 'starter' },
      user: {
        email: 'admin@example.com',
        organizationContext: {
          organization: { id: 'org-1' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await BillingController.createCheckoutSession(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Billing upgrades are unavailable in this environment until Stripe is configured.',
      configured: false,
    });
    expect(next).not.toHaveBeenCalled();
  });
});
