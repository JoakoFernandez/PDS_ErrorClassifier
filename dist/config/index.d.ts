export declare const config: {
    port: number;
    nodeEnv: "development" | "production" | "test";
    openai: {
        apiKey: string;
        model: string;
        maxTokens: number;
        temperature: number;
    };
    redis: {
        url: string;
        ttlSeconds: number;
        keyPrefix: string;
        password?: string | undefined;
    };
    classification: {
        aiFallbackEnabled: boolean;
        aiConfidenceThreshold: number;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
    };
    logging: {
        level: "error" | "warn" | "info" | "debug";
        format: "json" | "pretty";
    };
};
export type Config = typeof config;
//# sourceMappingURL=index.d.ts.map