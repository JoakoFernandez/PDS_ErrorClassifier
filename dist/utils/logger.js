"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const config_1 = require("../config");
const formats = [];
if (config_1.config.logging.format === 'pretty') {
    formats.push(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
        const reqId = meta.requestId
            ? ` [${meta.requestId}]`
            : '';
        const rest = Object.keys(meta).filter(k => k !== 'requestId').length
            ? ` ${JSON.stringify(Object.fromEntries(Object.entries(meta).filter(([k]) => k !== 'requestId')))}`
            : '';
        return `${timestamp} ${level}:${reqId} ${message}${rest}`;
    }));
}
else {
    formats.push(winston_1.default.format.json());
}
exports.logger = winston_1.default.createLogger({
    level: config_1.config.logging.level,
    format: winston_1.default.format.combine(...formats),
    transports: [new winston_1.default.transports.Console()],
});
//# sourceMappingURL=logger.js.map