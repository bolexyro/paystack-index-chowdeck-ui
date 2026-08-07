import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { PaystackIndexClient } from "./index-client.js";
import {
  normalizeMenu,
  normalizeRestaurants,
  unwrapToolPayload
} from "./normalizers.js";
import { PreviewStore } from "./preview-store.js";
import type { UnknownRecord } from "./types.js";

const WIDGET_URIS = [
  "ui://chowdeck/index-v12.html",
  "ui://chowdeck/index-v9.html",
  "ui://chowdeck/index-v8.html",
  "ui://chowdeck/index-v7.html",
  "ui://chowdeck/index-v6.html",
  "ui://chowdeck/index-v5.html",
  "ui://chowdeck/index-v4.html",
  "ui://chowdeck/index-v3.html",
  "ui://chowdeck/index.html"
] as const;
const WIDGET_URI = WIDGET_URIS[0];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexClient = new PaystackIndexClient();
const previews = new PreviewStore();
const indexId = z.union([z.string().min(1), z.number().int().positive()]);

function numericId(value: string | number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid Paystack Index id: ${value}`);
  }
  return parsed;
}

function toolMeta() {
  return {
    ui: { resourceUri: WIDGET_URI },
    "openai/outputTemplate": WIDGET_URI,
    "openai/widgetAccessible": true
  };
}

function success(data: UnknownRecord, message: string) {
  return {
    structuredContent: data,
    content: [{ type: "text" as const, text: message }]
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  // Keep expected upstream/business failures in the app state rather than
  // marking the MCP call as a transport error. ChatGPT's widget host turns
  // `isError: true` into a generic banner, which hides actionable details
  // such as an insufficient wallet balance. The typed error view still
  // prevents confirmation because it contains no confirmation token.
  return {
    structuredContent: { view: "error", error: true, message },
    content: [{ type: "text" as const, text: message }]
  };
}

function assertUpstreamSuccess(payload: UnknownRecord) {
  if (payload.isError !== true) return;
  const content = Array.isArray(payload.content) ? payload.content : [];
  const text = content
    .filter((entry): entry is UnknownRecord =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    )
    .map((entry) => entry.text)
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  throw new Error(text ?? "Paystack Index could not complete that request.");
}

async function readWidgetResource(uri: string) {
  const htmlPath = path.join(root, "web", "dist", "index.html");
  const jsPath = path.join(root, "web", "dist", "widget.js");
  const cssPath = path.join(root, "web", "dist", "widget.css");
  const [shell, js, css] = await Promise.all([
    readFile(htmlPath, "utf8"),
    readFile(jsPath, "utf8"),
    readFile(cssPath, "utf8").catch(() => "")
  ]);
  // Inline bundles must not contain literal closing tags: the HTML parser
  // would terminate the element early and render the remaining JS as text.
  const inlineJs = js.replace(/<\/script/gi, "<\\/script");
  const inlineCss = css.replace(/<\/style/gi, "<\\/style");
  const html = shell
    .replace(
      /<script[^>]+src="[^"]+"[^>]*><\/script>/,
      () =>
        `<style>${inlineCss}</style><script type="module">${inlineJs}</script>`
    )
    .replace(/<link[^>]+stylesheet[^>]*>/g, "");
  return {
    contents: [
      {
        uri,
        mimeType: RESOURCE_MIME_TYPE,
        text: html,
          _meta: {
            ui: {
              // A stable iframe origin keeps the app compatible with hosts that
              // validate the standard MCP Apps resource metadata during fetch.
              domain: "https://chowdeck-ui.local",
              prefersBorder: false,
              csp: {
                connectDomains: [],
                resourceDomains: [
                  "https://files.chowdeck.com",
                  "https://fonts.googleapis.com",
                "https://fonts.gstatic.com"
              ]
            }
          },
          "openai/widgetPrefersBorder": false,
          "openai/widgetCSP": {
            resource_domains: [
              "https://files.chowdeck.com",
              "https://fonts.googleapis.com",
              "https://fonts.gstatic.com"
            ],
            connect_domains: []
          }
        }
      }
    ]
  };
}

async function findChowdeckRestaurants({
  query,
  addressId,
  addressQuery,
  limit
}: {
  query?: string;
  addressId?: string | number;
  addressQuery?: string;
  limit: number;
}) {
  const upstreamArgs: UnknownRecord = {
    merchant_id: "chowdeck",
    limit
  };
  if (query) upstreamArgs.query = query;
  if (addressId) upstreamArgs.address_id = numericId(addressId);
  if (addressQuery) upstreamArgs.address_query = addressQuery;

  let payload = unwrapToolPayload(
    await indexClient.callTool("find_items", upstreamArgs)
  );
  assertUpstreamSuccess(payload);
  if (
    payload.needs_address_choice === true &&
    (typeof payload.current_address_id === "string" ||
      typeof payload.current_address_id === "number") &&
    !addressId
  ) {
    payload = unwrapToolPayload(
      await indexClient.callTool("find_items", {
        ...upstreamArgs,
        address_id: numericId(payload.current_address_id)
      })
    );
    assertUpstreamSuccess(payload);
  }
  return payload;
}

async function createServer() {
  const server = new McpServer({
    name: "Chowdeck UI for Paystack Index",
    version: "0.2.3"
  }, {
    instructions:
      "Chowdeck is an agent-led ordering assistant, not a standalone storefront. For discovery, call chowdeck_browse to get structured candidates, then call chowdeck_render_recommendations with only the small set that best matches the user's request. After chowdeck_menu returns a menu, if the user asks to filter, compare, or narrow it, call chowdeck_render_menu_picks with only the matching item IDs. Keep every widget focused on the decision at hand; do not render or repeat a full catalogue unless the user explicitly asks for it."
  });

  WIDGET_URIS.forEach((uri, index) => {
    registerAppResource(
      server,
      `chowdeck-widget-${index}`,
      uri,
      {},
      () => readWidgetResource(uri)
    );
  });

  registerAppTool(
    server,
    "chowdeck_browse",
    {
      title: "Find Chowdeck options",
      description:
        "Data step for Chowdeck discovery. Find nearby restaurants and return structured candidates for the agent. Do not render the full catalogue from this tool; after it returns, choose a small set that matches the user's request and call chowdeck_render_recommendations.",
      inputSchema: {
        query: z.string().optional(),
        addressId: indexId.optional(),
        addressQuery: z.string().optional(),
        limit: z.number().int().min(1).max(30).default(16)
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: {},
    },
    async ({ query, addressId, addressQuery, limit }) => {
      try {
        const payload = await findChowdeckRestaurants({
          query,
          addressId,
          addressQuery,
          limit
        });
        const restaurants = normalizeRestaurants(payload);
        return success({
          view: "browse",
          query,
          restaurants,
          address: payload.address_used,
          addressId: payload.address_id_used,
          openCount: payload.open_count
        }, `Found ${restaurants.length} nearby Chowdeck options for the agent to narrow down.`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  registerAppTool(
    server,
    "chowdeck_render_recommendations",
    {
      title: "Show selected Chowdeck options",
      description:
        "Render a focused decision card with a small, agent-selected set of Chowdeck restaurants. Always call chowdeck_browse first, then pass only the best 1–5 vendor IDs for the user's request. This is the only discovery tool that should render UI; never show the entire catalogue.",
      inputSchema: {
        restaurantIds: z
          .array(indexId)
          .min(1)
          .max(5)
          .describe("The 1–5 vendor IDs the agent selected for the user"),
        addressId: indexId.optional(),
        title: z.string().min(1).max(80).optional(),
        subtitle: z.string().min(1).max(140).optional()
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: toolMeta()
    },
    async ({ restaurantIds, addressId, title, subtitle }) => {
      try {
        const payload = await findChowdeckRestaurants({
          addressId,
          limit: 20
        });
        const selectedIds = new Set(restaurantIds.map((id) => String(id)));
        const restaurants = normalizeRestaurants(payload).filter((restaurant) =>
          selectedIds.has(restaurant.vendorId)
        );
        if (!restaurants.length) {
          throw new Error(
            "Those Chowdeck options are no longer available. Find nearby options again."
          );
        }
        return success({
          view: "recommendations",
          restaurants,
          address: payload.address_used,
          addressId: payload.address_id_used,
          openCount: payload.open_count,
          title: title ?? "A few good options",
          subtitle:
            subtitle ?? "I picked a short list for you. Choose one to open its menu."
        }, `I’ve opened ${restaurants.length} selected Chowdeck options in a focused picker.`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  registerAppTool(
    server,
    "chowdeck_connect",
    {
      title: "Connect a Chowdeck account",
      description:
        "Open the focused Chowdeck connection panel. Use it to send a phone number and submit the OTP; do not ask the user to paste credentials into a long chat flow when the panel is available.",
      inputSchema: {
        phoneNumber: z
          .string()
          .min(7)
          .max(20)
          .describe("The phone number registered on Chowdeck"),
        otp: z
          .string()
          .regex(/^\d{4,8}$/)
          .optional()
          .describe("The one-time code sent to the phone")
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      },
      _meta: toolMeta()
    },
    async ({ phoneNumber, otp }) => {
      try {
        const args: UnknownRecord = {
          merchant_id: "chowdeck",
          phone: phoneNumber
        };
        if (otp) args.otp = otp;
        const payload = unwrapToolPayload(
          await indexClient.callTool("connect_merchant", args)
        );
        assertUpstreamSuccess(payload);
        const linked =
          payload.connected === true ||
          payload.linked === true ||
          payload.success === true ||
          payload.status === "connected";
        return success({
          view: "connect",
          stage: linked ? "connected" : "otp",
          linked,
          message:
            payload.message ??
            (linked
              ? "Your Chowdeck account is connected."
              : "Enter the OTP sent to your phone."),
          // Retain the number only in the widget's current in-memory state so it
          // can complete the second step. It is never stored or logged.
          phoneNumber
        }, linked ? "Chowdeck is connected in the app." : "The Chowdeck connection panel is ready for the OTP.");
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  registerAppTool(
    server,
    "chowdeck_menu",
    {
      title: "Open a Chowdeck restaurant menu",
      description:
        "Open the menu data for one restaurant after the user selects it. The app owns menu items and prices. If the user then asks for a filter, budget, comparison, or shortlist, call chowdeck_render_menu_picks instead of pasting a long list into the conversation.",
      inputSchema: {
        vendorId: indexId,
        addressId: indexId.optional()
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: toolMeta()
    },
    async ({ vendorId, addressId }) => {
      try {
        const args: UnknownRecord = {
          merchant_id: "chowdeck",
          vendor_id: numericId(vendorId)
        };
        if (addressId) args.address_id = numericId(addressId);
        const payload = unwrapToolPayload(
          await indexClient.callTool("find_items", args)
        );
        assertUpstreamSuccess(payload);
        const menu = normalizeMenu(payload);
        return success({
          view: "menu",
          menu,
          address: payload.address_used,
          addressId: payload.address_id_used ?? addressId
        }, `I’ve opened ${menu.vendorName}’s menu in the app.`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  registerAppTool(
    server,
    "chowdeck_render_menu_picks",
    {
      title: "Show selected Chowdeck menu items",
      description:
        "Render a focused set of 1–8 menu items from a restaurant's menu. Call chowdeck_menu first, use the returned structured menu to choose the items that match the user's budget or request, then pass only those item IDs here. This keeps filtered menu results in the UI instead of dumping a long text list into chat.",
      inputSchema: {
        vendorId: indexId,
        itemIds: z
          .array(indexId)
          .min(1)
          .max(8)
          .describe("The 1–8 menu item IDs selected from the current restaurant menu"),
        addressId: indexId.optional(),
        title: z.string().min(1).max(80).optional(),
        subtitle: z.string().min(1).max(140).optional()
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: toolMeta()
    },
    async ({ vendorId, itemIds, addressId, title, subtitle }) => {
      try {
        const args: UnknownRecord = {
          merchant_id: "chowdeck",
          vendor_id: numericId(vendorId)
        };
        if (addressId) args.address_id = numericId(addressId);
        const payload = unwrapToolPayload(
          await indexClient.callTool("find_items", args)
        );
        assertUpstreamSuccess(payload);
        const menu = normalizeMenu(payload);
        const selectedIds = new Set(itemIds.map(String));
        const items = menu.categories
          .flatMap((category) => category.items)
          .filter((item) => selectedIds.has(item.itemId));
        if (!items.length) {
          throw new Error(
            "Those Chowdeck menu items are no longer available. Open the menu again and choose from the current items."
          );
        }
        return success({
          view: "menu-picks",
          vendorId: menu.vendorId || String(vendorId),
          vendorName: menu.vendorName,
          isOpen: menu.isOpen,
          items,
          address: payload.address_used,
          addressId: payload.address_id_used ?? addressId,
          title: title ?? "Good picks under your budget",
          subtitle:
            subtitle ?? `A short list from ${menu.vendorName}'s menu.`
        }, `I’ve narrowed ${menu.vendorName}’s menu to ${items.length} selected options in the app.`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  const orderItems = z.array(
    z.object({
      itemId: indexId,
      quantity: z.number().int().min(1).max(20)
    })
  );

  registerAppTool(
    server,
    "chowdeck_preview_order",
    {
      title: "Preview a Chowdeck order",
      description:
        "Prepare the selected basket and open a focused review step with required options or the exact total. This never confirms payment.",
      inputSchema: {
        vendorId: indexId,
        items: orderItems.min(1),
        addressId: indexId.optional(),
        notes: z.string().max(500).optional(),
        options: z.record(z.unknown()).optional()
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      },
      _meta: toolMeta()
    },
    async ({ vendorId, items, addressId, notes, options }) => {
      try {
        const args: UnknownRecord = {
          category: "food",
          merchant_id: "chowdeck",
          vendor_id: numericId(vendorId),
          items: items.map((item) => ({
            item_id: numericId(item.itemId),
            quantity: item.quantity
          }))
        };
        if (addressId) args.address_id = numericId(addressId);
        if (notes) args.vendor_note = notes;
        if (options) args.modifier_selections = options;
        const payload = unwrapToolPayload(
          await indexClient.callTool("order", args)
        );
        assertUpstreamSuccess(payload);
        if (
          payload.needs_confirmation === true ||
          payload.status === "needs_confirmation"
        ) {
          const confirmation = previews.create(args, payload);
          return success({
            view: "confirm",
            preview: payload,
            confirmationToken: confirmation.token,
            confirmationExpiresAt: confirmation.expiresAt
          }, "Your order review is ready in the app. Nothing has been charged.");
        }
        return success({
          view:
            payload.needs_options === true || payload.status === "needs_options"
              ? "options"
              : "preview",
          preview: payload
        }, "The selected basket is ready for review in the app.");
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  registerAppTool(
    server,
    "chowdeck_confirm_order",
    {
      title: "Place the explicitly approved Chowdeck order",
      description:
        "Place a previously previewed Chowdeck order only after the user presses the final Place order button in the app.",
      inputSchema: {
        confirmationToken: z.string().uuid(),
        confirmed: z.literal(true)
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      },
      _meta: toolMeta()
    },
    async ({ confirmationToken }) => {
      try {
        const preview = previews.consume(confirmationToken);
        if (!preview) {
          throw new Error(
            "This order preview expired or was already used. Preview the cart again."
          );
        }
        const payload = unwrapToolPayload(
          await indexClient.callTool("order", {
            ...preview.upstreamArgs,
            confirmed: true
          })
        );
        assertUpstreamSuccess(payload);
        return success({ view: "tracking", order: payload }, "Your Chowdeck order is placed; tracking is open in the app.");
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  registerAppTool(
    server,
    "chowdeck_track_order",
    {
      title: "Track a Chowdeck order",
      description: "Open focused delivery tracking for an existing Chowdeck order.",
      inputSchema: {
        orderId: z.string().min(1)
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: toolMeta()
    },
    async ({ orderId }) => {
      try {
        const payload = unwrapToolPayload(
          await indexClient.callTool("track_order", {
            merchant_id: "chowdeck",
            order_id: orderId
          })
        );
        assertUpstreamSuccess(payload);
        return success({ view: "tracking", order: payload }, "I’ve opened the latest Chowdeck delivery status in the app.");
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  return server;
}

const app = express();
app.use(express.json({ limit: "1mb" }));
app.get("/health", (_request, response) =>
  response.json({ ok: true, service: "index-chowdeck-ui" })
);

const transports = new Map<string, StreamableHTTPServerTransport>();

app.all("/mcp", async (request, response) => {
  try {
    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      const statelessRecovery = Boolean(sessionId);
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: statelessRecovery ? undefined : () => randomUUID(),
        ...(statelessRecovery
          ? {}
          : {
              onsessioninitialized: (id: string) => {
                transports.set(id, transport!);
              }
            })
      });
      if (!statelessRecovery) {
        transport.onclose = () => {
          if (transport?.sessionId) transports.delete(transport.sessionId);
        };
      }
      const server = await createServer();
      await server.connect(transport);
    }
    await transport.handleRequest(request, response, request.body);
  } catch (error) {
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error"
        },
        id: null
      });
    }
  }
});

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
app.listen(port, host, () => {
  console.log(`Chowdeck UI MCP listening on http://${host}:${port}/mcp`);
});
