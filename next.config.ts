import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
    /* config options here */
        allowedDevOrigins: ['192.168.88.191'],
    async headers() {
        return [
            {
                source: "/booking/:token",
                headers: [
                    { key: "Cache-Control", value: "private, no-store, max-age=0" },
                    { key: "Referrer-Policy", value: "no-referrer" },
                    { key: "X-Robots-Tag", value: "noindex, nofollow" },
                ],
            },
        ];
    },
};

export default withPayload(nextConfig);
