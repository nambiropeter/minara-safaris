import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
    /* config options here */
        allowedDevOrigins: ['192.168.88.191'],
    images: {
        // Hotel photos are served from Hotelbeds' CDN, not our own storage.
        remotePatterns: [{ protocol: "https", hostname: "photos.hotelbeds.com", pathname: "/giata/**" }],
        // On an IPv6-only/NAT64 dev network that host resolves to 64:ff9b:: addresses, which
        // Next's SSRF guard reads as private. Development only: production keeps the guard.
        dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    },
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
