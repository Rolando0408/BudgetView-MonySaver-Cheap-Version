import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	async redirects() {
		return [
			{
				source: "/",
				destination: "/login",
				permanent: false,
			},
		];
	},
	devIndicators: {
		// @ts-expect-error appIsrStatus is supported at runtime but missing in type defs.
		appIsrStatus: false,
	},

};

export default nextConfig;
