import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The project sits below a directory that also contains lockfiles, so pin the
  // workspace root explicitly rather than letting Next infer the wrong one.
  turbopack: { root: path.resolve(".") },
  // This repo keeps its own agent notes; don't regenerate boilerplate ones.
  agentRules: false,
};

export default nextConfig;
