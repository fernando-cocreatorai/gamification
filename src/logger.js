const winston = require('winston');
const path = require('path');

// Define log file paths
const errorLogPath = path.join(__dirname, '..', 'logs', 'error.log');
const combinedLogPath = path.join(__dirname, '..', 'logs', 'combined.log');

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: errorLogPath, level: 'error' }),
    new winston.transports.File({ filename: combinedLogPath })
  ]
});

// If we're not in production, log to the console with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;