// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const browseOutput = {
  view: "recommendations",
  title: "A few good options",
  subtitle: "I picked a short list for you.",
  address: "Lekki Phase 1, Lagos",
  restaurants: [
    {
      vendorId: "demo-1",
      name: "Native Foods",
      location: "Admiralty Way",
      rating: 4.8,
      etaMinutes: 31,
      deliveryFeeNaira: 1200,
      isOpen: true
    }
  ]
};

const menuOutput = {
  view: "menu",
  vendorId: "demo-1",
  addressId: 991,
  menu: {
    vendorId: "demo-1",
    vendorName: "Native Foods",
    isOpen: true,
    categories: [
      {
        menuId: "popular",
        name: "Most loved",
        items: [
          {
            itemId: "jollof-chicken",
            name: "Smoky party jollof",
            description: "Firewood-style jollof.",
            imageUrl: "https://files.chowdeck.com/jollof.png",
            priceNaira: 5800,
            available: true,
            requiresOptions: false,
            optionGroupIds: []
          }
        ]
      }
    ]
  }
};

const otherMenuOutput = {
  ...menuOutput,
  vendorId: "demo-2",
  menu: { ...menuOutput.menu, vendorId: "demo-2", vendorName: "Jollof & Co." }
};

const optionsOutput = {
  view: "options",
  vendorId: "demo-1",
  addressId: 991,
  items: [{ itemId: "refuel-meal", quantity: 1 }],
  preview: {
    status: "needs_options",
    items_needing_options: [
      {
        item_id: "refuel-meal",
        item_name: "Refuel Meal",
        required_groups: [
          {
            menu_group_id: "side",
            name: "Side",
            min_selection: 1,
            max_selection: 1,
            options: [
              { item_id: "jollof", name: "Smoky Jollof", price_naira: 0, in_stock: true },
              { item_id: "spaghetti", name: "Spaghetti", price_naira: 0, in_stock: true }
            ]
          },
          {
            menu_group_id: "style",
            name: "Style",
            min_selection: 1,
            max_selection: 1,
            options: [
              { item_id: "spicy", name: "Spicy", price_naira: 0, in_stock: true },
              { item_id: "crunchy", name: "Crunchy", price_naira: 0, in_stock: true }
            ]
          }
        ]
      }
    ]
  }
};

const menuPicksOutput = {
  view: "menu-picks",
  vendorId: "demo-1",
  vendorName: "Native Foods",
  items: [
    {
      itemId: "jollof-chicken",
      name: "Smoky party jollof",
      description: "Firewood-style jollof.",
      priceNaira: 5800,
      imageUrl: "https://files.chowdeck.com/jollof.png",
      available: true
    }
  ]
};

const closedBrowseOutput = {
  ...browseOutput,
  restaurants: [
    {
      ...browseOutput.restaurants[0],
      isOpen: false,
      nextOpening: "Tomorrow at 9:00 AM"
    }
  ]
};

function installOpenAiMock(initialOutput = browseOutput, previewMode: "confirm" | "options" = "confirm") {
  const callTool = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "chowdeck_browse") {
      return { structuredContent: { ...browseOutput, query: args.query } };
    }
    if (name === "chowdeck_menu") return { structuredContent: menuOutput };
    if (name === "chowdeck_preview_order") {
      if (previewMode === "options" && !args.options) {
        return { structuredContent: optionsOutput };
      }
      return {
        structuredContent: {
          view: "confirm",
          confirmationToken: "preview-token",
          preview: {
            needs_confirmation: true,
            items_total_naira: 5800,
            delivery_fee_naira: 1200,
            grand_total_naira: 7000
          }
        }
      };
    }
    return { structuredContent: { view: "tracking", order: { status: "Order placed" } } };
  });
  window.openai = { toolOutput: initialOutput, callTool };
  return callTool;
}

afterEach(() => {
  cleanup();
  delete window.openai;
});

describe("Chowdeck widget basket flow", () => {
  it("searches restaurants, opens a menu, adds an item, views the basket, and previews checkout", async () => {
    const callTool = installOpenAiMock();
    render(<App />);

    const search = screen.getByRole("textbox", { name: "Search restaurants or dishes" });
    fireEvent.change(search, { target: { value: "jollof" } });
    fireEvent.submit(search.closest("form")!);
    await waitFor(() => expect(callTool).toHaveBeenCalledWith("chowdeck_browse", {
      query: "jollof",
      addressId: undefined
    }));

    fireEvent.click(screen.getByRole("button", { name: /Native Foods/i }));
    await waitFor(() => expect(callTool).toHaveBeenCalledWith("chowdeck_menu", {
      vendorId: "demo-1",
      addressId: undefined
    }));
    expect(await screen.findByText("Smoky party jollof")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add Smoky party jollof" }));
    fireEvent.click(screen.getByRole("button", { name: "Open basket" }));
    expect(screen.getByText("Basket")).toBeTruthy();
    expect(screen.getByText("Order summary")).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "Smoky party jollof image" })).toHaveLength(2);
    expect(screen.getAllByText("Smoky party jollof")).toHaveLength(2);
    expect(screen.getByLabelText("1 in basket")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add another Smoky party jollof" }));
    expect(screen.getByLabelText("2 in basket")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Review order/ }));
    await waitFor(() => expect(callTool).toHaveBeenCalledWith("chowdeck_preview_order", {
      vendorId: "demo-1",
      addressId: 991,
      items: [{ itemId: "jollof-chicken", quantity: 2 }]
    }));
    expect(await screen.findByRole("heading", { name: "Ready when you are" })).toBeTruthy();
  });

  it("prevents mixing restaurants and offers a deliberate basket replacement", async () => {
    installOpenAiMock();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Native Foods/i }));
    await screen.findByText("Smoky party jollof");
    fireEvent.click(screen.getByRole("button", { name: "Add Smoky party jollof" }));

    fireEvent(window, new CustomEvent("openai:set_globals", {
      detail: { globals: { toolOutput: otherMenuOutput } }
    }));
    await waitFor(() => expect(screen.getByText("Jollof & Co.")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Add Smoky party jollof" }));

    expect(await screen.findByRole("heading", { name: "Replace your basket?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Replace basket" }));
    fireEvent.click(screen.getByRole("button", { name: "Open basket" }));
    expect(screen.getAllByText("Jollof & Co.")).toHaveLength(2);
    expect(screen.queryByText("Native Foods")).toBeNull();
  });

  it("keeps the delivery address when a follow-up response omits it", async () => {
    installOpenAiMock();
    render(<App />);
    expect(screen.getByText("Lekki Phase 1, Lagos")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Native Foods/i }));
    await screen.findByText("Smoky party jollof");

    expect(screen.getByText("Lekki Phase 1, Lagos")).toBeTruthy();
    expect(screen.queryByText("Your saved address")).toBeNull();
  });

  it("turns required Chowdeck options into a selectable review step", async () => {
    const callTool = installOpenAiMock(optionsOutput, "options");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Customise your meal" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Smoky Jollof/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Spicy/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to review" }));

    await waitFor(() => expect(callTool).toHaveBeenCalledWith("chowdeck_preview_order", {
      vendorId: "demo-1",
      addressId: 991,
      items: [{ itemId: "refuel-meal", quantity: 1 }],
      options: {
        "refuel-meal": [
          { menuGroupId: "side", itemId: "jollof", quantity: 1 },
          { menuGroupId: "style", itemId: "spicy", quantity: 1 }
        ]
      }
    }));
    expect(await screen.findByRole("heading", { name: "Ready when you are" })).toBeTruthy();
  });

  it("keeps the restaurant identity visible on focused food picks", () => {
    installOpenAiMock(menuPicksOutput);
    render(<App />);

    const venue = screen.getByLabelText("Ordering from Native Foods");
    expect(venue).toBeTruthy();
    expect(venue.textContent).toContain("Native Foods");
  });

  it("explains a closed search instead of leaving the restaurant surface blank", () => {
    window.openai = {
      toolOutput: closedBrowseOutput,
      callTool: vi.fn(async () => ({ structuredContent: closedBrowseOutput }))
    };
    render(<App />);
    expect(screen.getByRole("heading", { name: "Nothing open right now" })).toBeTruthy();
    expect(screen.getByText("Native Foods")).toBeTruthy();
    expect(screen.getByText("Tomorrow at 9:00 AM")).toBeTruthy();
  });
});
