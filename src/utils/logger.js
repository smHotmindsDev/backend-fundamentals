import pino from "pino";

const logger = pino(
    pino.transport({
        targets: [
            {
                target: 'pino/file',
                level: 'debug',
                // mkdir: logs/ is gitignored, so a fresh checkout (CI) has no such folder
                options: { destination: './logs/error.json', append: true, mkdir: true }
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