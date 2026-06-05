import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { config } from './config.js';

// Generate a secret key from the environment or use a default for development
const JWT_SECRET = process.env.JWT_SECRET || 'llmapi-default-secret-key';

// Create a simple token generation endpoint
export function generateToken() {
  return jwt.sign({
    sub: 'llmapi-user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days
  }, JWT_SECRET);
}

// Extend the Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: jwt.JwtPayload;
    }
  }
}

// JWT middleware for protecting routes
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: { message: 'Access token required', type: 'authentication_error', code: null, param: null },
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: { message: 'Invalid or expired token', type: 'authentication_error', code: null, param: null },
      });
    }
    req.user = user as jwt.JwtPayload;
    next();
  });
}

// For testing - generate token endpoint
export function createTokenRoute() {
  return (req: Request, res: Response) => {
    const token = generateToken();
    res.json({ token });
  };
}