import { useEffect, useState } from "react";
import { mockBrowse, mockMenu, mockMenuPicks } from "./mock";

type AnyRecord = Record<string, any>;
type CartContext = {
  vendorId: string;
  vendorName: string;
  addressId?: string | number;
};
type CartLine = CartContext & { item: AnyRecord; quantity: number };

function formatAddress(address: unknown) {
  if (typeof address === "string" && address.trim()) return address;
  if (address && typeof address === "object") {
    const value = address as AnyRecord;
    if (typeof value.pretty_name === "string" && value.pretty_name.trim()) {
      return value.pretty_name;
    }
    const cityState = [value.city, value.state]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join(", ");
    if (cityState) return cityState;
  }
  return "Your saved address";
}

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
});

function useToolOutput() {
  const [output, setOutput] = useState<AnyRecord>(
    () => window.openai ? (window.openai.toolOutput ?? { view: "idle" }) : mockBrowse
  );
  useEffect(() => {
    const handler = (event: WindowEventMap["openai:set_globals"]) => {
      const next = event.detail?.globals?.toolOutput;
      if (next) setOutput(next);
    };
    window.addEventListener("openai:set_globals", handler);
    return () => window.removeEventListener("openai:set_globals", handler);
  }, []);
  return [output, setOutput] as const;
}

function IdleSurface() {
  return (
    <section className="idle-view" aria-labelledby="idle-title">
      <span className="idle-mark">✦</span>
      <p className="eyebrow">Chowdeck on Index</p>
      <h1 id="idle-title">What are you in the mood for?</h1>
      <p>Ask the agent to find nearby restaurants or narrow a menu to what fits your budget.</p>
    </section>
  );
}

async function callTool(name: string, args: AnyRecord) {
  if (!window.openai?.callTool) {
    if (name === "chowdeck_menu") return mockMenu;
    if (name === "chowdeck_render_menu_picks") return mockMenuPicks;
    if (name === "chowdeck_render_recommendations") {
      return {
        ...mockBrowse,
        view: "recommendations",
        title: "A few good options",
        subtitle: "I picked a short list for you. Choose one to open its menu."
      };
    }
    if (name === "chowdeck_browse") return mockBrowse;
    if (name === "chowdeck_connect") {
      return args.otp
        ? {
            view: "connect",
            stage: "connected",
            linked: true,
            message: "Your Chowdeck account is connected.",
            phoneNumber: args.phoneNumber
          }
        : {
            view: "connect",
            stage: "otp",
            linked: false,
            message: "Enter the OTP sent to your phone.",
            phoneNumber: args.phoneNumber
          };
    }
    if (name === "chowdeck_preview_order") {
      return {
        view: "confirm",
        confirmationToken: "demo-only",
        preview: {
          needs_confirmation: true,
          items_total_naira: 7600,
          delivery_fee_naira: 1200,
          grand_total_naira: 8800,
          payment_route: "Chowdeck wallet",
          wallet_balance_naira: 24500,
          balance_after_naira: 15700
        }
      };
    }
    return { view: "tracking", order: { status: "Order placed" } };
  }
  const result = await window.openai.callTool(name, args);
  return result.structuredContent ?? result.structured_content ?? {};
}

function Icon({ name }: { name: "pin" | "search" | "star" | "bag" | "back" }) {
  const paths = {
    pin: <path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Zm0-9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />,
    search: <path d="m20 20-4.6-4.6m2.6-5.9a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" />,
    star: <path d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2L3 9.4l6.2-.9L12 2.8Z" />,
    bag: <path d="M5 8h14l-1 13H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2" />,
    back: <path d="m15 18-6-6 6-6" />
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function ImageWithFallback({
  src,
  alt,
  fallback
}: {
  src?: string;
  alt: string;
  fallback: string;
}) {
  const [failed, setFailed] = useState(!src);

  if (failed) {
    return <div className="image-fallback" aria-label={alt}>{fallback}</div>;
  }

  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}

function compactAddress(address: unknown) {
  const value = formatAddress(address);
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.slice(0, 2).join(", ") || value;
}

function RecommendationSurface({
  output,
  busy,
  onSelect,
  onSearch
}: {
  output: AnyRecord;
  busy: boolean;
  onSelect: (restaurant: AnyRecord) => void;
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState(
    () => (typeof output.query === "string" ? output.query : "")
  );
  const restaurants = (Array.isArray(output.restaurants) ? output.restaurants : [])
    .filter((restaurant: AnyRecord) => restaurant.isOpen !== false)
    .slice(0, 5);
  const closedRestaurants = (Array.isArray(output.restaurants) ? output.restaurants : [])
    .filter((restaurant: AnyRecord) => restaurant.isOpen === false)
    .slice(0, 4);
  const title = typeof output.title === "string" ? output.title : "A few good options";
  const subtitle =
    typeof output.subtitle === "string"
      ? output.subtitle
      : "I picked a short list for you. Choose one to open its menu.";

  return (
    <section className="recommendation-view" aria-labelledby="recommendation-title">
      <div className="recommendation-intro">
        <div className="agent-kicker">
          <span className="agent-kicker-mark">✦</span>
          <span>Picked for you by Chowdeck on Index</span>
        </div>
        <h1 id="recommendation-title">{title}</h1>
        <p>{subtitle}</p>
      </div>

      <form
        className="recommendation-search"
        onSubmit={(event) => {
          event.preventDefault();
          const nextQuery = query.trim();
          if (nextQuery) onSearch(nextQuery);
        }}
      >
        <Icon name="search" />
        <input
          aria-label="Search restaurants or dishes"
          placeholder="Search restaurants or dishes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" disabled={busy || !query.trim()}>Search</button>
      </form>

      <div className="recommendation-context" aria-label="Recommendation context">
        <span><Icon name="pin" /> {compactAddress(output.address)}</span>
        <span>{restaurants.length} {restaurants.length === 1 ? "pick" : "picks"}</span>
      </div>

      {restaurants.length > 0 ? (
        <div className="recommendation-list">
          {restaurants.map((restaurant: AnyRecord) => (
            <button
              className="recommendation-card"
              key={restaurant.vendorId}
              disabled={busy}
              onClick={() => onSelect(restaurant)}
            >
              <div className="recommendation-card-image">
                <ImageWithFallback
                  src={restaurant.imageUrl}
                  alt={`${restaurant.name} image`}
                  fallback="🍲"
                />
                <span className="recommendation-eta">
                  {restaurant.etaMinutes ?? "—"} min
                </span>
              </div>
              <div className="recommendation-card-copy">
                <div className="recommendation-card-heading">
                  <h2>{restaurant.name}</h2>
                  <span aria-hidden="true">↗</span>
                </div>
                <p>{restaurant.location ?? `${restaurant.distanceKm ?? "—"} km away`}</p>
                <div className="recommendation-meta">
                  <span><Icon name="star" /> {restaurant.rating ?? "New"}</span>
                  <span>{naira.format(restaurant.deliveryFeeNaira ?? 0)} delivery</span>
                </div>
                <span className="recommendation-cta">See menu</span>
              </div>
            </button>
          ))}
        </div>
      ) : closedRestaurants.length > 0 ? (
        <div className="recommendation-empty closed-results">
          <span>🌙</span>
          <h2>Nothing open right now</h2>
          <p>These nearby matches are closed, but you can try again when they reopen.</p>
          <div className="closed-restaurant-list">
            {closedRestaurants.map((restaurant: AnyRecord) => (
              <div className="closed-restaurant" key={restaurant.vendorId}>
                <div>
                  <strong>{restaurant.name}</strong>
                  <span>{restaurant.location ?? `${restaurant.distanceKm ?? "—"} km away`}</span>
                </div>
                <span>{restaurant.nextOpening ?? "Closed now"}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="recommendation-empty">
          <span>🍽</span>
          <h2>Waiting for a shortlist</h2>
          <p>Ask the agent to find nearby Chowdeck options for you.</p>
        </div>
      )}

    </section>
  );
}

function MenuPicksSurface({
  output,
  busy,
  cart,
  onAdd,
  onBack
}: {
  output: AnyRecord;
  busy: boolean;
  cart: CartLine[];
  onAdd: (item: AnyRecord) => void;
  onBack: () => void;
}) {
  const items = (Array.isArray(output.items) ? output.items : []).slice(0, 8);
  const vendorName = typeof output.vendorName === "string" ? output.vendorName : "Chowdeck menu";
  const title = typeof output.title === "string" ? output.title : "Good picks under your budget";
  const subtitle =
    typeof output.subtitle === "string"
      ? output.subtitle
      : `A short list from ${vendorName}'s menu.`;
  const quantityFor = (itemId: string) =>
    cart.find((line) => String(line.item.itemId) === String(itemId))?.quantity ?? 0;

  return (
    <section className="menu-picks-view" aria-labelledby="menu-picks-title">
      <button className="back" onClick={onBack} aria-label="Back to full menu" title="Back to full menu">
        <Icon name="back" /> <span>Menu</span>
      </button>

      <div className="menu-picks-title">
        <p className="eyebrow">{vendorName}</p>
        <h1 id="menu-picks-title">{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="menu-picks-context" aria-label="Menu picks context">
        <span>{items.length} {items.length === 1 ? "pick" : "picks"}</span>
        <span>Selected from the live menu</span>
      </div>

      {items.length > 0 ? (
        <div className="menu-picks-grid">
          {items.map((item: AnyRecord) => {
            const quantity = quantityFor(String(item.itemId));
            const available = item.available !== false;
            return (
              <article className={available ? "menu-pick-card" : "menu-pick-card unavailable"} key={item.itemId}>
                <div className="menu-pick-image">
                  <ImageWithFallback
                    src={item.imageUrl}
                    alt={`${item.name} image`}
                    fallback="🍛"
                  />
                  <span>{available ? "Available" : "Sold out"}</span>
                </div>
                <div className="menu-pick-copy">
                  <h2>{item.name}</h2>
                  <p>{item.description ?? "A Chowdeck favorite."}</p>
                  <div className="menu-pick-footer">
                    <strong>{naira.format(item.priceNaira ?? 0)}</strong>
                    <button
                      className="menu-pick-add"
                      disabled={busy || !available}
                      onClick={() => onAdd(item)}
                      aria-label={`${quantity ? "Add another" : "Add"} ${item.name}`}
                    >
                      {quantity ? `${quantity} added` : "Add"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="recommendation-empty">
          <span>🍽</span>
          <h2>No matching items</h2>
          <p>Ask the agent to try another budget or menu preference.</p>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [output, setOutput] = useToolOutput();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<{
    item: AnyRecord;
    context: CartContext;
  } | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [error, setError] = useState("");

  const view = output.view ?? "browse";
  useEffect(() => {
    if (view === "connect") setConnectOpen(true);
  }, [view]);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, line) => sum + Number(line.item.priceNaira ?? 0) * line.quantity,
    0
  );
  const cartContext = cart[0];

  async function invoke(name: string, args: AnyRecord) {
    setBusy(true);
    setError("");
    try {
      setOutput(await callTool(name, args));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function commitAdd(item: AnyRecord, context: CartContext) {
    setCart((current) => {
      const existing = current.find(
        (line) => String(line.item.itemId) === String(item.itemId)
      );
      if (existing) {
        return current.map((line) =>
          line === existing ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, { item, quantity: 1, ...context }];
    });
  }

  function add(item: AnyRecord, context: CartContext) {
    const current = cart[0];
    const sameVendor = !current || current.vendorId === context.vendorId;
    const sameAddress =
      !current?.addressId ||
      !context.addressId ||
      String(current.addressId) === String(context.addressId);
    if (!sameVendor || !sameAddress) {
      setPendingAdd({ item, context });
      return;
    }
    commitAdd(item, context);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="location"
          onClick={() => invoke("chowdeck_browse", {})}
          aria-label="Change delivery location"
        >
          <span className="pin"><Icon name="pin" /></span>
          <span>
            <small>Delivering to</small>
            <strong>{formatAddress(output.address)}</strong>
          </span>
          <span className="chevron">⌄</span>
        </button>
        <button className="wordmark" onClick={() => setConnectOpen(true)} aria-label="Connect Chowdeck">
          <i>c</i>
          <span>chowdeck</span>
          <em>on Index</em>
        </button>
        <button
          className="bag-button"
          onClick={() => setCartOpen(true)}
          aria-label="Open basket"
          title={cartCount ? `${cartCount} item${cartCount === 1 ? "" : "s"} in basket` : "Basket is empty"}
        >
          <Icon name="bag" />
          {cartCount > 0 && <b>{cartCount}</b>}
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {busy && <div className="loading-bar" />}

      {view === "idle" && <IdleSurface />}

      {(view === "browse" || view === "recommendations") && (
        <RecommendationSurface
          output={output}
          busy={busy}
          onSearch={(query) =>
            invoke("chowdeck_browse", {
              query,
              addressId: output.addressId
            })
          }
          onSelect={(restaurant) =>
            invoke("chowdeck_menu", {
              vendorId: restaurant.vendorId,
              addressId: output.addressId
            })
          }
        />
      )}

      {view === "menu-picks" && (
        <MenuPicksSurface
          output={output}
          busy={busy}
          cart={cart}
          onAdd={(item) =>
            add(item, {
              vendorId: String(output.vendorId ?? output.menu?.vendorId ?? ""),
              vendorName: String(output.vendorName ?? output.menu?.vendorName ?? "Chowdeck"),
              addressId: output.addressId
            })
          }
          onBack={() => {
            if (output.vendorId) {
              invoke("chowdeck_menu", {
                vendorId: output.vendorId,
                addressId: output.addressId
              });
            } else {
              setOutput(mockMenu);
            }
          }}
        />
      )}

      {view === "menu" && output.menu && (
        <section className="menu-view">
          <button className="back" onClick={() => invoke("chowdeck_browse", {})}>
            <Icon name="back" /> All restaurants
          </button>
          <div className="menu-title">
            <p className="eyebrow">Now serving</p>
            <h1>{output.menu.vendorName}</h1>
            <span>{output.menu.isOpen ? "Open for orders" : "Currently closed"}</span>
          </div>
          <nav className="category-nav">
            {output.menu.categories.map((category: AnyRecord) => (
              <a key={category.menuId} href={`#${category.menuId}`}>
                {category.name}
              </a>
            ))}
          </nav>
          {output.menu.categories.map((category: AnyRecord) => (
            <section className="menu-category" id={category.menuId} key={category.menuId}>
              <h2>{category.name}</h2>
              <div className="menu-grid">
                {category.items.map((item: AnyRecord) => (
                  <article className={!item.available ? "menu-item unavailable" : "menu-item"} key={item.itemId}>
                    <div className="item-copy">
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <strong>{naira.format(item.priceNaira)}</strong>
                    </div>
                    <div className="item-image">
                      <ImageWithFallback src={item.imageUrl} alt={`${item.name} image`} fallback="🍛" />
                      <button
                        disabled={!item.available}
                        onClick={() =>
                          add(item, {
                            vendorId: String(output.menu.vendorId),
                            vendorName: output.menu.vendorName,
                            addressId: output.addressId
                          })
                        }
                        aria-label={`Add ${item.name}`}
                      >
                        {item.available ? "+" : "Sold out"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      )}

      {(view === "confirm" || view === "preview" || view === "options") && (
        <Confirmation
          output={output}
          busy={busy}
          onBack={() => setOutput(mockMenu)}
          onConfirm={() =>
            invoke("chowdeck_confirm_order", {
              confirmationToken: output.confirmationToken,
              confirmed: true
            })
          }
        />
      )}

      {view === "tracking" && <Tracking order={output.order ?? {}} />}
      {view === "error" && (
        <section className="empty-state">
          <span>!</span><h2>We hit a snag</h2><p>{output.message}</p>
          <button onClick={() => invoke("chowdeck_browse", {})}>Try again</button>
        </section>
      )}

      {cartCount > 0 && view !== "confirm" && view !== "tracking" && (
        <button className="floating-cart" onClick={() => setCartOpen(true)}>
          <span>{cartCount}</span>
          <strong>View basket</strong>
          <b>{naira.format(cartTotal)}</b>
        </button>
      )}

      {cartOpen && (
        <CartDrawer
          cart={cart}
          total={cartTotal}
          busy={busy}
          vendorName={cartContext?.vendorName}
          onClose={() => setCartOpen(false)}
          onChange={(itemId, delta) =>
            setCart((current) =>
              current
                .map((line) =>
                  String(line.item.itemId) === String(itemId)
                    ? { ...line, quantity: line.quantity + delta }
                    : line
                )
                .filter((line) => line.quantity > 0)
            )
          }
          onClear={() => setCart([])}
          onCheckout={() => {
            setCartOpen(false);
            invoke("chowdeck_preview_order", {
              vendorId: cartContext?.vendorId ?? mockMenu.menu.vendorId,
              addressId: cartContext?.addressId,
              items: cart.map((line) => ({
                itemId: String(line.item.itemId),
                quantity: line.quantity
              }))
            });
          }}
        />
      )}

      {pendingAdd && (
        <CartConflictSheet
          currentVendor={cartContext?.vendorName ?? "your current restaurant"}
          nextVendor={pendingAdd.context.vendorName}
          onKeep={() => setPendingAdd(null)}
          onReplace={() => {
            setCart([{ item: pendingAdd.item, quantity: 1, ...pendingAdd.context }]);
            setPendingAdd(null);
          }}
        />
      )}

      {connectOpen && (
        <ConnectSheet
          busy={busy}
          toolOutput={view === "connect" ? output : undefined}
          onClose={() => setConnectOpen(false)}
          onSubmit={async (phoneNumber, otp) => {
            setBusy(true);
            setError("");
            try {
              const next = await callTool("chowdeck_connect", {
                phoneNumber,
                otp: otp || undefined
              });
              setOutput(next);
              if (next.linked || next.stage === "connected") {
                window.setTimeout(() => {
                  setConnectOpen(false);
                  invoke("chowdeck_browse", {});
                }, 900);
              }
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "Could not connect Chowdeck"
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

    </main>
  );
}

function ConnectSheet({
  busy,
  toolOutput,
  onClose,
  onSubmit
}: {
  busy: boolean;
  toolOutput?: AnyRecord;
  onClose: () => void;
  onSubmit: (phoneNumber: string, otp?: string) => void;
}) {
  const [phoneNumber, setPhoneNumber] = useState(
    () => toolOutput?.phoneNumber ?? ""
  );
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp" | "connected">(
    () => toolOutput?.stage ?? "phone"
  );

  useEffect(() => {
    if (!toolOutput) return;
    if (toolOutput.phoneNumber) setPhoneNumber(toolOutput.phoneNumber);
    if (toolOutput.stage) setStage(toolOutput.stage);
  }, [toolOutput]);

  return (
    <div className="scrim connect-scrim" onMouseDown={onClose}>
      <section
        className="connect-sheet"
        onMouseDown={(event) => event.stopPropagation()}
        aria-labelledby="connect-title"
      >
        <button className="connect-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {stage === "connected" ? (
          <div className="connect-success">
            <span>✓</span>
            <p className="eyebrow">All set</p>
            <h2 id="connect-title">Chowdeck connected</h2>
            <p>{toolOutput?.message ?? "Your restaurants are loading now."}</p>
          </div>
        ) : (
          <>
            <span className="connect-mark">c</span>
            <p className="eyebrow">
              {stage === "otp" ? "Check your phone" : "One-time setup"}
            </p>
            <h2 id="connect-title">
              {stage === "otp" ? "Enter your OTP" : "Connect Chowdeck"}
            </h2>
            <p className="connect-intro">
              {stage === "otp"
                ? `We sent a code to ${maskPhone(phoneNumber)}.`
                : "Use the phone number on your Chowdeck account. Paystack Index handles the secure connection."}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (stage === "phone") {
                  onSubmit(phoneNumber);
                  setStage("otp");
                } else {
                  onSubmit(phoneNumber, otp);
                }
              }}
            >
              {stage === "phone" ? (
                <label>
                  <span>Phone number</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+234 800 000 0000"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    required
                    minLength={7}
                    maxLength={20}
                  />
                </label>
              ) : (
                <label>
                  <span>One-time code</span>
                  <input
                    className="otp-input"
                    type="text"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{4,8}"
                    placeholder="• • • • • •"
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                    required
                    autoFocus
                  />
                </label>
              )}
              <button
                className="primary"
                disabled={
                  busy ||
                  phoneNumber.trim().length < 7 ||
                  (stage === "otp" && otp.length < 4)
                }
              >
                {busy
                  ? "Connecting…"
                  : stage === "otp"
                    ? "Verify and connect"
                    : "Send OTP"}
              </button>
            </form>
            {stage === "otp" && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => onSubmit(phoneNumber)}
              >
                Send a new code
              </button>
            )}
            <small className="privacy-note">
              The number and OTP are used for this connection only. This app does not
              save them.
            </small>
          </>
        )}
      </section>
    </div>
  );
}

function maskPhone(phone: string) {
  const compact = phone.replace(/\s/g, "");
  if (compact.length < 7) return "your phone";
  return `${compact.slice(0, 4)}••••${compact.slice(-3)}`;
}

function CartDrawer({
  cart,
  total,
  busy,
  vendorName,
  onClose,
  onChange,
  onClear,
  onCheckout
}: {
  cart: CartLine[];
  total: number;
  busy: boolean;
  vendorName?: string;
  onClose: () => void;
  onChange: (itemId: string, delta: number) => void;
  onClear: () => void;
  onCheckout: () => void;
}) {
  return (
    <div className="scrim" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <p className="eyebrow">Your order</p>
            <h2>Basket</h2>
            {vendorName && <span className="drawer-vendor">{vendorName}</span>}
          </div>
          <button onClick={onClose} aria-label="Close basket">×</button>
        </div>
        {cart.length > 0 ? (
          <div className="cart-lines">
            {cart.map((line) => (
              <div className="cart-line" key={line.item.itemId}>
                <div>
                  <strong>{line.item.name}</strong>
                  <span>{naira.format(Number(line.item.priceNaira ?? 0))} each</span>
                </div>
                <div className="stepper">
                  <button
                    onClick={() => onChange(String(line.item.itemId), -1)}
                    aria-label={`Remove one ${line.item.name}`}
                  >−</button>
                  <b aria-label={`${line.quantity} in basket`}>{line.quantity}</b>
                  <button
                    onClick={() => onChange(String(line.item.itemId), 1)}
                    aria-label={`Add another ${line.item.name}`}
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="cart-empty">
            <span>🛍</span>
            <h3>Your basket is empty</h3>
            <p>Pick a restaurant, then add something you like.</p>
          </div>
        )}
        <div className="drawer-total"><span>Items total</span><strong>{naira.format(total)}</strong></div>
        <p className="fee-note">Delivery and service fees appear before you approve payment.</p>
        {cart.length > 0 && <button className="text-button clear-basket" onClick={onClear}>Clear basket</button>}
        <button className="primary" disabled={busy || !cart.length} onClick={onCheckout}>
          Review order
        </button>
      </aside>
    </div>
  );
}

function CartConflictSheet({
  currentVendor,
  nextVendor,
  onKeep,
  onReplace
}: {
  currentVendor: string;
  nextVendor: string;
  onKeep: () => void;
  onReplace: () => void;
}) {
  return (
    <div className="scrim connect-scrim" onMouseDown={onKeep}>
      <section
        className="connect-sheet basket-conflict"
        onMouseDown={(event) => event.stopPropagation()}
        aria-labelledby="basket-conflict-title"
      >
        <span className="connect-mark">!</span>
        <p className="eyebrow">One restaurant at a time</p>
        <h2 id="basket-conflict-title">Replace your basket?</h2>
        <p className="connect-intro">
          Your basket is from <strong>{currentVendor}</strong>. Adding from <strong>{nextVendor}</strong> will clear it.
        </p>
        <div className="basket-conflict-actions">
          <button className="secondary-action" onClick={onKeep}>Keep current basket</button>
          <button className="primary" onClick={onReplace}>Replace basket</button>
        </div>
      </section>
    </div>
  );
}

function Confirmation({
  output,
  busy,
  onBack,
  onConfirm
}: {
  output: AnyRecord;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const preview = output.preview ?? {};
  if (output.view === "options") {
    return (
      <section className="confirm-page">
        <button className="back" onClick={onBack}><Icon name="back" /> Back to menu</button>
        <div className="confirm-card">
          <p className="eyebrow">One more choice</p>
          <h1>Customise your meal</h1>
          <p className="muted">This restaurant requires options for one or more items. The live option groups will appear here.</p>
          <pre>{JSON.stringify(preview.options ?? preview, null, 2)}</pre>
        </div>
      </section>
    );
  }
  return (
    <section className="confirm-page">
      <button className="back" onClick={onBack}><Icon name="back" /> Back to menu</button>
      <div className="confirm-card">
        <span className="shield">✓</span>
        <p className="eyebrow">Final check</p>
        <h1>Ready when you are</h1>
        <p className="muted">Nothing is charged until you press the button below.</p>
        <div className="receipt">
          <div><span>Items</span><strong>{naira.format(preview.items_total_naira ?? preview.itemsTotalNaira ?? 0)}</strong></div>
          <div><span>Delivery</span><strong>{naira.format(preview.delivery_fee_naira ?? preview.deliveryFeeNaira ?? 0)}</strong></div>
          <hr />
          <div className="grand"><span>Total</span><strong>{naira.format(preview.grand_total_naira ?? preview.grandTotalNaira ?? 0)}</strong></div>
        </div>
        <div className="payment-route">
          <span>Paying with</span>
          <strong>{preview.payment_route ?? preview.paymentRoute ?? "Chowdeck wallet / linked Zap"}</strong>
        </div>
        <button className="primary danger" disabled={busy || !output.confirmationToken} onClick={onConfirm}>
          {busy ? "Placing order…" : "Place order and pay"}
        </button>
        <small className="legal">By continuing, you approve this exact total. The approval expires in 10 minutes.</small>
      </div>
    </section>
  );
}

function Tracking({ order }: { order: AnyRecord }) {
  const status = order.status ?? order.order_status ?? "Order placed";
  const steps = ["Order placed", "Restaurant accepted", "Preparing", "Rider on the way", "Delivered"];
  const current = Math.max(0, steps.findIndex((step) => status.toLowerCase().includes(step.split(" ")[0].toLowerCase())));
  return (
    <section className="tracking">
      <div className="tracker-hero"><span>🛵</span><p className="eyebrow">Live order</p><h1>{status}</h1><p>Your food is moving. We’ll keep this page up to date.</p></div>
      <div className="timeline">
        {steps.map((step, index) => (
          <div className={index <= current ? "done" : ""} key={step}>
            <i>{index < current ? "✓" : index + 1}</i><span><strong>{step}</strong>{index === current && <small>Current status</small>}</span>
          </div>
        ))}
      </div>
      {order.tracking_url && <a className="primary link" href={order.tracking_url} target="_blank" rel="noreferrer">Open live map</a>}
    </section>
  );
}
