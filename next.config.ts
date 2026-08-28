import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
    /* config options here */
        allowedDevOrigins: ['192.168.88.191'],
};

export default withPayload(nextConfig);
