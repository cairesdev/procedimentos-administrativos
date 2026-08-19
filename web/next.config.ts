import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagem enxuta: o build já embute o servidor e só as dependências usadas.
  output: "standalone",
  reactCompiler: true,
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
