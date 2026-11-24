import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", ".open-next/**", ".wrangler/**", "node_modules/**", "coverage/**", "next-env.d.ts", "netlify/**"] },
  {
    // Engine ต้องเป็น TypeScript บริสุทธิ์: ห้ามพึ่ง UI / Firebase / Next
    files: ["src/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["react", "react-dom", "next", "next/*"], message: "engine ห้าม import UI" },
          { group: ["firebase", "firebase/*", "firebase-admin", "firebase-admin/*"], message: "engine ห้าม import Firebase" },
          { group: ["@/lib/*", "@/components/*", "@/app/*"], message: "engine ห้ามพึ่งชั้น UI/lib" },
        ],
      }],
    },
  },
  {
    // Validator ต้องอิสระจาก solver
    files: ["src/engine/validator.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["./heuristic", "./ga", "./agent", "./solve"], message: "validator ห้าม import solver" }],
      }],
    },
  },
  {
    // ไฟล์ client ห้ามแตะ firebase-admin
    files: ["src/components/**/*.{ts,tsx}", "src/app/**/page.tsx", "src/lib/store/**/*.{ts,tsx}", "src/lib/export/**/*.ts", "src/lib/import/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["firebase-admin", "firebase-admin/*", "@/lib/firebase/admin"], message: "firebase-admin ใช้ได้เฉพาะฝั่ง server" }],
      }],
    },
  },
];

export default config;
