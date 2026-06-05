import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';

// In production, you'd want to require initial authentication to generate tokens
// This is a simplified example - in production, you'd use a more robust system

// Simple password-based auth for token generation (can be enhanced with proper auth)
const INITIAL_PASSWORD = process.env.INITIAL_PASSWORD || 'default-initial-password';

export function validateInitialAuth(req: Request, res: Response, next: NextFunction) {
  // If this is a token generation request, check if we have an initial password
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // For production, you'd want to validate an API key or password here
  // This is just a basic example
  if (req.path === '/token' && req.method === 'GET') {
    // In a real implementation, this would validate a password/API key
    // For now, we'll allow it for development but in production,
    // you'd require a proper initial authentication

    // Check if there's an initial password in the request headers
    const password = req.headers['x-initial-password'] as string;

    if (password !== INITIAL_PASSWORD) {
      // In production, we should reject this request entirely
      return res.status(401).json({
        error: { message: 'Initial authentication required', type: 'authentication_error', code: null, param: null },
      });
    }
  }

  next();
}

// This function would be called for initial setup
export function setupInitialAuth(password: string) {
  // In a production scenario, this would be stored securely
  // This is just for illustration
  process.env.INITIAL_PASSWORD = password;
}