import { createGoogleGenerativeAI } from "@ai-sdk/google";

// @ai-sdk/google looks for GOOGLE_GENERATIVE_AI_API_KEY by default; wired to
// GEMINI_API_KEY explicitly here to match the naming already used in env.
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

export const summarizerModel = google("gemini-flash-latest");
