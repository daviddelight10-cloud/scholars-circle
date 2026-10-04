import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/security.log'), 
      level: 'warn' 
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/combined.log') 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export const logSecurityEvent = (userId, eventType, details, req) => {
  const ip = req?.ip || null;
  const userAgent = req?.get?.('user-agent') || null;
  logger.warn({
    type: 'security',
    userId,
    eventType,
    details,
    ip,
    userAgent,
    timestamp: new Date().toISOString()
  });
  // Persist to DB for the admin audit trail — fire-and-forget, never block the request.
  prisma.securityEvent.create({
    data: {
      userId: userId || null,
      eventType: String(eventType || "unknown"),
      details: details || {},
      ip,
      userAgent,
    },
  }).catch(() => {});
};

export const logError = (error, context = {}) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
};

export const logInfo = (message, context = {}) => {
  logger.info({
    message,
    ...context,
    timestamp: new Date().toISOString()
  });
};

export default logger;
