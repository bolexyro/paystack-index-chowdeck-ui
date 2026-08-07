import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { UnknownRecord } from "./types.js";

interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

export class PaystackIndexClient {
  private token?: { value: string; expiresAt: number };

  constructor(
    private readonly config = {
      clientId: process.env.PAYSTACK_INDEX_CLIENT_ID ?? "",
      clientSecret: process.env.PAYSTACK_INDEX_CLIENT_SECRET ?? "",
      tokenUrl:
        process.env.PAYSTACK_INDEX_TOKEN_URL ??
        "https://mcp.paystack.africa/oauth/token",
      mcpUrl:
        process.env.PAYSTACK_INDEX_MCP_URL ??
        "https://mcp.paystack.africa/mcp"
    }
  ) {}

  async callTool(name: string, args: UnknownRecord): Promise<unknown> {
    const accessToken = await this.getToken();
    const transport = new StreamableHTTPClientTransport(
      new URL(this.config.mcpUrl),
      {
        requestInit: {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      }
    );
    const client = new Client({
      name: "index-chowdeck-ui-adapter",
      version: "0.1.0"
    });
    try {
      await client.connect(transport);
      return await client.callTool({ name, arguments: args });
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  private async getToken() {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.value;
    }
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error(
        "PAYSTACK_INDEX_CLIENT_ID and PAYSTACK_INDEX_CLIENT_SECRET are required"
      );
    }

    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: "mcp:transact"
      })
    });
    if (!response.ok) {
      throw new Error(`Paystack Index authentication failed (${response.status})`);
    }
    const token = (await response.json()) as TokenResponse;
    this.token = {
      value: token.access_token,
      expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000
    };
    return token.access_token;
  }
}

