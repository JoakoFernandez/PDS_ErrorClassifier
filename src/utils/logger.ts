import winston from 'winston';
import { config } from '../config';

const formats: winston.Logform.Format[] = [];

if (config.logging.format === 'pretty') {
  formats.push(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const reqId = (meta as Record<string, unknown>).requestId
        ? ` [${(meta as Record<string, unknown>).requestId}]`
        : '';
      const rest = Object.keys(meta as object).filter(k => k !== 'requestId').length
        ? ` ${JSON.stringify(Object.fromEntries(
            Object.entries(meta as Record<string, unknown>).filter(([k]) => k !== 'requestId')
          ))}`
        : '';
      return `${timestamp} ${level}:${reqId} ${message}${rest}`;
    })
  );
} else {
  formats.push(winston.format.json());
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(...formats),
  transports: [new winston.transports.Console()],
});
