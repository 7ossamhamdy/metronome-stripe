import Stripe from 'stripe';
import { NextFunction, RequestHandler, Response } from 'express';
import { MetronomeAPIError } from './metronome/MetronomeService';
import { APIError } from '@metronome/sdk';

export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};

export const errorHandler = (error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof Stripe.errors.StripeError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof MetronomeAPIError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof APIError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  console.log(error);
  return res.status(500).json({
    success: false,
    message: error?.message || 'Something went wrong',
  });
};
