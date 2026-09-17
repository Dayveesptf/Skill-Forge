let GoogleGenAIClass:
  | typeof import("@google/genai", { with: { "resolution-mode": "import" } }).GoogleGenAI
  | null = null;

let ai:
  | InstanceType<typeof import("@google/genai", { with: { "resolution-mode": "import" } }).GoogleGenAI>
  | null = null;

const apiKey =
  process.env.GEMINI_API_KEY;

const model =
  process.env.GEMINI_MODEL ||
  "gemini-2.5-flash";

if (!apiKey) {
  console.warn(
    "GEMINI_API_KEY is not configured. AI features will not work."
  );
}

async function getAI() {
  if (!apiKey) {
    throw new Error(
      "Gemini AI is not configured. Add GEMINI_API_KEY to the backend .env file."
    );
  }

  if (!ai) {
    const { GoogleGenAI } = await import("@google/genai");

    GoogleGenAIClass = GoogleGenAI;

    ai = new GoogleGenAI({
      apiKey
    });
  }

  return ai;
}

function extractJson(
  text: string
): string {
  let cleaned =
    text.trim();

  if (
    cleaned.startsWith(
      "```json"
    )
  ) {
    cleaned =
      cleaned.substring(
        7
      );
  }

  if (
    cleaned.startsWith(
      "```"
    )
  ) {
    cleaned =
      cleaned.substring(
        3
      );
  }

  if (
    cleaned.endsWith(
      "```"
    )
  ) {
    cleaned =
      cleaned.substring(
        0,
        cleaned.length - 3
      );
  }

  cleaned =
    cleaned.trim();

  const firstObject =
    cleaned.indexOf("{");

  const firstArray =
    cleaned.indexOf("[");

  let start = -1;

  if (
    firstObject !== -1 &&
    firstArray !== -1
  ) {
    start =
      Math.min(
        firstObject,
        firstArray
      );
  } else {
    start =
      firstObject !== -1
        ? firstObject
        : firstArray;
  }

  if (start > 0) {
    cleaned =
      cleaned.substring(
        start
      );
  }

  const lastObject =
    cleaned.lastIndexOf("}");

  const lastArray =
    cleaned.lastIndexOf("]");

  const end =
    Math.max(
      lastObject,
      lastArray
    );

  if (end !== -1) {
    cleaned =
      cleaned.substring(
        0,
        end + 1
      );
  }

  return cleaned.trim();
}

export async function generateGeminiJson<T>(
  prompt: string
): Promise<T> {
  const gemini = await getAI();

  const response =
    await gemini.models.generateContent({
      model,

      contents: prompt,

      config: {
        temperature: 0.2,

        responseMimeType:
          "application/json"
      }
    });

  const text =
    response.text?.trim();

  if (!text) {
    throw new Error(
      "Gemini returned an empty response"
    );
  }

  const jsonText =
    extractJson(text);

  try {
    return JSON.parse(
      jsonText
    ) as T;
  } catch {
    throw new Error(
      "Gemini returned invalid JSON"
    );
  }
}

export function getGeminiModel(): string {
  return model;
}