import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.5-flash-lite", // Flash is perfect here - review is a fast, focused task.
});

const reviewPrompt = PromptTemplate.fromTemplate(
  `You are a Senior Software Engineer with a non-negotiable standard for excellence, acting as a meticulous code reviewer. Your primary goal is to ensure 100% compliance with the provided technical specification. Do not accept "close enough."

  A code generation agent has produced the code for the file "{{path}}". Your task is to perform a rigorous audit.

  **YOUR REVIEW MUST BE BASED ON THIS STRICT CHECKLIST:**
  1.  **Correctness & Completeness:** Does the code *perfectly* and *completely* implement the stated "purpose" from the specification? Are any requirements from the purpose missing?
  2.  **API & Schema Compliance:** Does the code adhere *exactly* to the provided "api_contract" and "database_schema"?
      - For backend code: Check every model field, data type, and controller logic against the spec.
      - For frontend code: Check that API calls use the correct endpoints, HTTP methods, and request body structures defined in the API contract.
  3.  **Dependency Integration:** Does the code correctly import and use functions or models from its dependencies? (The source code for dependencies is not provided, but you must infer correct usage from the overall project specification).
  4.  **Robustness:** Are there obvious bugs, such as null reference errors (e.g., accessing "user.id" without checking if "user" exists), logical flaws, or missing error handling?

  **GENERATED CODE TO REVIEW:**
  ---
  {{generated_code}}
  ---
  
  **FULL TECHNICAL SPECIFICATION (Your Source of Truth):**
  ---
  {{specification}}
  ---

  **YOUR OUTPUT:**
  You must respond with a single, raw JSON object with two keys:
  1.  **"review_passed"**: A boolean ("true" only if the code passes ALL checklist items, otherwise "false").
  2.  **"feedback"**:
      - If it passes, the feedback MUST be: "Code is clean, correct, and fully compliant with the specification."
      - If it fails, the feedback MUST be a clear, direct, and actionable command for the generation agent. Be specific.
        - **Good Example:** "The 'Project' model is missing the 'packType' field which is required by the database_schema."
        - **Bad Example:** "The model is wrong."

  **CRITICAL:** Do NOT wrap your JSON response in markdown code blocks. Your entire output must be the raw JSON object itself.`,
  {
    templateFormat: "mustache",
  }
);

export async function reviewGeneratedCode(fileTask, generatedCode, masterPlan) {
  const relevantSpec = {
    purpose: fileTask.purpose,
    api_contract: masterPlan.api_contract,
    database_schema: masterPlan.database_schema,
  };

  const reviewChain = reviewPrompt.pipe(model).pipe(new StringOutputParser());
  const rawResponse = await reviewChain.invoke({
    path: fileTask.path,
    specification: JSON.stringify(relevantSpec, null, 2),
    generated_code: generatedCode,
  });

  try {
    const jsonStringMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonStringMatch)
      throw new Error("No JSON object found in reviewer's response.");
    return JSON.parse(jsonStringMatch[0]);
  } catch (error) {
    console.warn(
      `Reviewer returned malformed JSON for ${fileTask.path}. Defaulting to a failed review.`
    );
    return {
      review_passed: false,
      feedback:
        "The reviewer AI failed to produce valid JSON feedback. Regenerating the code is necessary.",
    };
  }
}
