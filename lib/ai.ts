import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Initialize clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  content: string;
  provider: "anthropic" | "openai";
  model: string;
}

/**
 * Generate AI completion with fallback support
 * Tries Anthropic first, falls back to OpenAI if there's an error
 */
export async function generateAICompletion(
  messages: AIMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: {
      anthropic?: string;
      openai?: string;
    };
  }
): Promise<AIResponse> {
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 1024;
  const anthropicModel = options?.model?.anthropic ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";
  const openaiModel = options?.model?.openai ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  // Try Anthropic first
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log("[AI] Attempting to use Anthropic...");

      // Convert messages to Anthropic format
      // Anthropic doesn't have a "system" role in messages, so we need to extract it
      const systemMessage = messages.find((m) => m.role === "system");
      const conversationMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const response = await anthropic.messages.create({
        model: anthropicModel,
        max_tokens: maxTokens,
        temperature,
        system: systemMessage?.content,
        messages: conversationMessages,
      });

      const content =
        response.content[0].type === "text" ? response.content[0].text : "";

      console.log("[AI] Successfully used Anthropic");
      return {
        content,
        provider: "anthropic",
        model: anthropicModel,
      };
    } catch (error: any) {
      console.error("[AI] Anthropic error:", error.message);
      console.log("[AI] Falling back to OpenAI...");
    }
  } else {
    console.log("[AI] No Anthropic API key, skipping to OpenAI...");
  }

  // Fallback to OpenAI
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "No AI API keys configured. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY"
    );
  }

  try {
    console.log("[AI] Attempting to use OpenAI...");

    const response = await openai.chat.completions.create({
      model: openaiModel,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      max_tokens: maxTokens,
    });

    const content = response.choices[0]?.message?.content || "";

    console.log("[AI] Successfully used OpenAI");
    return {
      content,
      provider: "openai",
      model: openaiModel,
    };
  } catch (error: any) {
    console.error("[AI] OpenAI error:", error.message);
    throw new Error(`All AI providers failed. Last error: ${error.message}`);
  }
}

/**
 * Helper function to categorize an email using AI
 */
export async function categorizeEmail(
  emailContent: {
    subject: string;
    from: string;
    snippet: string;
  },
  categories: Array<{ name: string; description: string }>
): Promise<string> {
  const categoryList = categories
    .map((c) => `- ${c.name}: ${c.description}`)
    .join("\n");

  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are an email categorization assistant. Your job is to analyze emails and assign them to the most appropriate category based on the category descriptions.

Available categories:
${categoryList}

Rules:
1. Return ONLY the category name, nothing else
2. If no category fits well, return "General"
3. Be accurate and consider the email's context`,
    },
    {
      role: "user",
      content: `Please categorize this email:

Subject: ${emailContent.subject}
From: ${emailContent.from}
Preview: ${emailContent.snippet}

Which category does this email belong to?`,
    },
  ];

  const response = await generateAICompletion(messages, {
    temperature: 0.3, // Lower temperature for more consistent categorization
    maxTokens: 50, // We only need the category name
  });

  // Extract just the category name from the response
  const categoryName = response.content.trim();

  // Validate that the returned category exists
  const validCategory = categories.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );

  return validCategory ? validCategory.name : "General";
}

/**
 * Helper function to generate a concise summary of an email
 */
export async function generateEmailSummary(emailContent: {
  subject: string;
  from: string;
  snippet: string;
}): Promise<string> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are an email summarization assistant. Your job is to create concise, actionable summaries of emails.

Rules:
1. Keep summaries under 100 words
2. Focus on key information and action items
3. Use clear, direct language
4. Highlight important details (dates, amounts, deadlines)
5. Do NOT include greetings or sign-offs
6. Write in third person (e.g., "The sender requests..." not "They request...")`,
    },
    {
      role: "user",
      content: `Please summarize this email:

Subject: ${emailContent.subject}
From: ${emailContent.from}
Preview: ${emailContent.snippet}

Provide a concise summary:`,
    },
  ];

  const response = await generateAICompletion(messages, {
    temperature: 0.5, // Balanced for consistent but natural summaries
    maxTokens: 150, // Enough for a good summary
  });

  return response.content.trim();
}
