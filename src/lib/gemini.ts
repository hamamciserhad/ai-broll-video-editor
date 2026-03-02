import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import type { GeminiMetadata } from "@/types/database";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `You are an expert video editor. Analyze this talking-head video and identify the top 3-5 moments where inserting B-Roll cutaway footage would significantly enhance viewer engagement.

Return ONLY a JSON response matching the provided schema. Each cue must include:
- Precise start/end timestamps in HH:MM:SS format
- A detailed visual description for sourcing or generating the B-Roll clip
- A brief reason explaining why this moment benefits from B-Roll
- A pexels_keyword: a short 2-4 word search term optimized for stock video libraries (concrete nouns/adjectives only, no articles or filler words). Examples: "holographic interface hands", "city skyline drone", "artificial intelligence robots", "coffee shop laptop"`;

/**
 * Uploads a local video file to the Gemini File API and waits until it is
 * ready for inference. Returns the file URI to pass to generateContent().
 */
export async function uploadVideoToGemini(
  filePath: string,
  mimeType = "video/mp4"
): Promise<string> {
  const displayName = filePath.split("/").pop() ?? "video.mp4";

  const { file: uploadedFile } = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName,
  });

  // Poll until the file is processed (Gemini needs to transcode it).
  // Cap at 100 attempts (~5 minutes) to prevent an infinite hang if the
  // File API gets stuck in PROCESSING due to an outage or corrupt upload.
  const MAX_POLLS = 100;
  let polls = 0;
  let file = await fileManager.getFile(uploadedFile.name);
  while (file.state === FileState.PROCESSING) {
    if (++polls > MAX_POLLS) {
      throw new Error(
        "Gemini File API: timed out waiting for video to process (>5 min)"
      );
    }
    await new Promise((r) => setTimeout(r, 3_000));
    file = await fileManager.getFile(uploadedFile.name);
  }

  if (file.state === FileState.FAILED) {
    throw new Error("Gemini File API: video transcoding failed");
  }

  // Return the URI from the polled (verified-ready) file object, not the
  // initial upload response — these are the same in practice but using the
  // poll result is semantically correct (the file is confirmed active).
  return file.uri;
}

/**
 * Calls Gemini 2.5 Flash with a video file URI and returns structured B-Roll
 * cues as JSON, enforced via responseSchema.
 */
export async function analyzeVideoForBRoll(
  fileUri: string,
  mimeType = "video/mp4"
): Promise<GeminiMetadata> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          b_roll_cues: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                start_time: {
                  type: SchemaType.STRING,
                  description: "Start timestamp in HH:MM:SS format",
                },
                end_time: {
                  type: SchemaType.STRING,
                  description: "End timestamp in HH:MM:SS format",
                },
                visual_description: {
                  type: SchemaType.STRING,
                  description:
                    "Precise prompt describing the B-Roll imagery needed",
                },
                reason: {
                  type: SchemaType.STRING,
                  description: "Brief explanation of why B-Roll fits here",
                },
                pexels_keyword: {
                  type: SchemaType.STRING,
                  description:
                    "Short 2-4 word stock video search term (concrete nouns/adjectives, no filler words). Example: 'holographic interface hands'",
                },
              },
              required: ["start_time", "end_time", "visual_description", "reason", "pexels_keyword"],
            },
          },
        },
        required: ["b_roll_cues"],
      },
    },
  });

  const result = await model.generateContent([
    { fileData: { fileUri, mimeType } },
    { text: SYSTEM_PROMPT },
  ]);

  const raw = result.response.text();
  try {
    return JSON.parse(raw) as GeminiMetadata;
  } catch {
    throw new Error(
      `Gemini returned non-JSON response: ${raw.slice(0, 200)}`
    );
  }
}
