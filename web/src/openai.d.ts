export {};

declare global {
  interface Window {
    openai?: {
      toolOutput?: Record<string, unknown>;
      toolInput?: Record<string, unknown>;
      widgetState?: Record<string, unknown>;
      setWidgetState?: (state: Record<string, unknown>) => void;
      callTool: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{
        structuredContent?: Record<string, unknown>;
        structured_content?: Record<string, unknown>;
        isError?: boolean;
      }>;
    };
  }

  interface WindowEventMap {
    "openai:set_globals": CustomEvent<{
      globals?: {
        toolOutput?: Record<string, unknown>;
        toolInput?: Record<string, unknown>;
        widgetState?: Record<string, unknown>;
      };
    }>;
  }
}
