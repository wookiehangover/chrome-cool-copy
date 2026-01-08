/**
 * Browser-compatible bash sandbox
 * Provides bash, readFile, and writeFile tools for the boost authoring agent
 * Uses dynamic import to load just-bash only when needed
 */

import { tool } from "ai";
import { z } from "zod";

/**
 * Schema for bash command execution
 */
const bashSchema = z.object({
  command: z.string().describe("The bash command to execute"),
});

/**
 * Schema for reading files
 */
const readFileSchema = z.object({
  path: z.string().describe("The file path to read"),
});

/**
 * Schema for writing files
 */
const writeFileSchema = z.object({
  path: z.string().describe("The file path to write to"),
  content: z.string().describe("The content to write"),
});

/**
 * Initialize bash sandbox with files
 * Returns tools for bash, readFile, and writeFile
 */
export async function createBashSandbox(files: Record<string, string> = {}) {
  let bash: any = null;

  // Try to dynamically import just-bash
  try {
    const module = await import("just-bash/browser");
    const Bash = module.Bash;
    bash = new Bash({
      files,
      cwd: "/workspace",
    });
  } catch (error) {
    console.warn("[Bash Sandbox] Failed to initialize just-bash:", error);
    // Continue with null bash - tools will return errors
  }

  /**
   * Bash tool - execute bash commands
   */
  const bashTool = tool({
    description:
      "Execute bash commands in a sandboxed environment. Available files: /workspace/boost.js, /workspace/page.html",
    inputSchema: bashSchema,
    execute: async (params) => {
      if (!bash) {
        return {
          stdout: "",
          stderr: "Bash sandbox not available",
          exitCode: 1,
        };
      }
      try {
        const result = await bash.exec(params.command);
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      } catch (error) {
        return {
          stdout: "",
          stderr: error instanceof Error ? error.message : String(error),
          exitCode: 1,
        };
      }
    },
  });

  /**
   * Read file tool
   */
  const readFileTool = tool({
    description: "Read the contents of a file from the sandbox",
    inputSchema: readFileSchema,
    execute: async (params) => {
      if (!bash) {
        return {
          success: false,
          error: "Bash sandbox not available",
        };
      }
      try {
        const result = await bash.exec(`cat "${params.path}"`);
        if (result.exitCode !== 0) {
          return {
            success: false,
            error: `Failed to read file: ${result.stderr}`,
          };
        }
        return {
          success: true,
          content: result.stdout,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

  /**
   * Write file tool
   */
  const writeFileTool = tool({
    description: "Write content to a file in the sandbox",
    inputSchema: writeFileSchema,
    execute: async (params) => {
      if (!bash) {
        return {
          success: false,
          error: "Bash sandbox not available",
        };
      }
      try {
        // Use heredoc to safely write content with special characters
        const escapedPath = params.path.replace(/"/g, '\\"');
        const writeCommand = `cat > "${escapedPath}" << 'BASH_SANDBOX_EOF'\n${params.content}\nBASH_SANDBOX_EOF`;
        const result = await bash.exec(writeCommand);
        if (result.exitCode !== 0) {
          return {
            success: false,
            error: `Failed to write file: ${result.stderr}`,
          };
        }
        return {
          success: true,
          message: `File written successfully: ${params.path}`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

  return {
    bash: bashTool,
    readFile: readFileTool,
    writeFile: writeFileTool,
    tools: {
      bash: bashTool,
      readFile: readFileTool,
      writeFile: writeFileTool,
    },
  };
}
