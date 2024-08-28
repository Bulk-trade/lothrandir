import winston from 'winston';
import LokiTransport from 'winston-loki';

// Define custom format
const customFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.align(),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
);

// Create a Winston logger
export const logger = winston.createLogger({
    level: 'info',
    format: customFormat,
    transports: [
        //Loki transport
        new LokiTransport({
            host: "http://127.0.0.1:3100"
        }),
        // Console transport
        new winston.transports.Console(),
        // File transport
        new winston.transports.File({ filename: 'logs/bulk.log' }),
        // Add more transports as needed
    ],
});

export function logInfo(message: any, value?: any) {

    // Check if the message is not a string and stringify it
    const formattedMessage = typeof message !== 'string' ? JSON.stringify(message, null, 2) : message;

    // Check if the value is provided and is not a string, then stringify it
    const formattedValue = value !== undefined && typeof value !== 'string' ? JSON.stringify(value, null, 2) : value;

    if (value !== undefined) {
        // If value is provided, log it as an object with the message as key
        logger.info(`${formattedMessage} : ${formattedValue}`);
    } else {
        // Otherwise, log the message directly
        logger.info(formattedMessage);
    }
};

export type Logger = typeof logger;
