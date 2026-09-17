import pino from "pino";

// pino-pretty only for a human at a terminal. When stdout is a pipe (node --test,
// CI, Docker) the pretty worker thread sometimes keeps the process alive after
// the tests finish, so there we write plain JSON lines to stdout instead.
const stdoutTarget = process.stdout.isTTY
    ? { target: 'pino-pretty', level: 'info', options: { colorize: true } }
    : { target: 'pino/file', level: 'info', options: { destination: 1 } };

const logger = pino(
    pino.transport({
        targets: [
            {
                target: 'pino/file',
                level: 'debug',
                // mkdir: logs/ is gitignored, so a fresh checkout (CI) has no such folder
                options: { destination: './logs/error.json', append: true, mkdir: true }
            },
            stdoutTarget,
        ],
    })
);

export default logger;
