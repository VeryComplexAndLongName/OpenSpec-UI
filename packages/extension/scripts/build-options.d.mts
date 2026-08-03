import type { BuildOptions } from "esbuild";

export function extensionHostBuildOptions(): BuildOptions;
export function webviewBuildOptions(): BuildOptions;
export function testSuiteBuildOptions(): BuildOptions;
export function standaloneAssetsBuildOptions(): BuildOptions;
