import pino from "pino";

const logger = pino(
    pino.transport({
        targets: [
            {
                target: 'pino/file',
                level: 'debug',
                options: { destination: './logs/error.json', append: true }
            },
            {
                target: 'pino-pretty',
                level: 'info',
                options: { colorize: true }
            }
        ],
    })
);

export default logger;