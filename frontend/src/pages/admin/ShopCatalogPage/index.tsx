import React, { useState } from "react";

export interface ShopItem {
  id: string;
  sku: string;
  title: string;
  category: "Theme" | "Accessory" | "Power-up";
  coinPrice: number;
  requiredLevel: number;
  assetUrl: string;
  available: boolean;
  shelfOrder: number;
  purchases: number;
}

interface Props {
  items: ShopItem[];
  save: (item: Omit<ShopItem, "purchases">) => Promise<void>;
  setAvailability: (id: string, available: boolean) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
}

const blank: Omit<ShopItem, "purchases"> = {
  id: "",
  sku: "",
  title: "",
  category: "Theme",
  coinPrice: 0,
  requiredLevel: 1,
  assetUrl: "",
  available: true,
  shelfOrder: 0,
};

export default function ShopCatalogPage({ items, save, setAvailability, reorder }: Props) {
  const [edit, setEdit] = useState<Omit<ShopItem, "purchases"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const popularItems = [...items].sort((a, b) => b.purchases - a.purchases).slice(0, 5);

  async function commit(event: React.FormEvent) {
    event.preventDefault();
    if (!edit) return;

    setBusy(true);
    try {
      await save(edit);
      setEdit(null);
      setMessage("Catalog item saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function moveItem(id: string, delta: number) {
    const sorted = [...items].sort((a, b) => a.shelfOrder - b.shelfOrder);
    const index = sorted.findIndex((item) => item.id === id);
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= sorted.length) return;

    const current = sorted[index];
    const target = sorted[nextIndex];
    if (current === undefined || target === undefined) return;
    sorted[index] = target;
    sorted[nextIndex] = current;
    try {
      await reorder(sorted.map((item) => item.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reorder failed.");
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Shop Catalog</h1>
      <button onClick={() => setEdit({ ...blank })}>Add item</button>

      <h2>Popular items</h2>
      <ol>
        {popularItems.map((item) => (
          <li key={item.id}>
            {item.title} — {item.purchases.toLocaleString()} purchases
          </li>
        ))}
      </ol>

      <table style={{ width: "100%" }}>
        <thead>
          <tr>
            <th align="left">Item</th>
            <th>Category</th>
            <th>Price</th>
            <th>Level</th>
            <th>Available</th>
            <th>Shelf order</th>
            <th>Sales</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...items]
            .sort((a, b) => a.shelfOrder - b.shelfOrder)
            .map((item) => (
              <tr key={item.id}>
                <td>
                  {item.title}
                  <br />
                  <small>{item.sku}</small>
                </td>
                <td>{item.category}</td>
                <td align="right">{item.coinPrice} coins</td>
                <td align="center">{item.requiredLevel}</td>
                <td align="center">
                  <input
                    type="checkbox"
                    checked={item.available}
                    onChange={(event) => {
                      const available = event.target.checked;
                      void (async () => {
                        try {
                          await setAvailability(item.id, available);
                        } catch (error) {
                          setMessage(
                            error instanceof Error ? error.message : "Availability update failed.",
                          );
                        }
                      })();
                    }}
                  />
                </td>
                <td>
                  <button aria-label="Move up" onClick={() => void moveItem(item.id, -1)}>
                    ↑
                  </button>{" "}
                  <button aria-label="Move down" onClick={() => void moveItem(item.id, 1)}>
                    ↓
                  </button>
                </td>
                <td align="right">{item.purchases}</td>
                <td>
                  <button onClick={() => setEdit({ ...item })}>Edit</button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {edit && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "#0008",
            display: "grid",
            placeItems: "center",
          }}
        >
          <form
            onSubmit={(event) => {
          void commit(event);
        }}
            style={{
              background: "white",
              padding: 24,
              borderRadius: 12,
              width: "min(540px, 90vw)",
            }}
          >
            <h2>{edit.id ? "Edit" : "Add"} shop item</h2>

            {(["sku", "title", "assetUrl"] as const).map((key) => (
              <p key={key}>
                <label>
                  {key === "assetUrl" ? "Asset URL" : key.toUpperCase()}{" "}
                  <input
                    required
                    value={edit[key]}
                    onChange={(event) => setEdit({ ...edit, [key]: event.target.value })}
                  />
                </label>
              </p>
            ))}

            <p>
              <label>
                Category{" "}
                <select
                  value={edit.category}
                  onChange={(event) =>
                    setEdit({ ...edit, category: event.target.value as ShopItem["category"] })
                  }
                >
                  <option>Theme</option>
                  <option>Accessory</option>
                  <option>Power-up</option>
                </select>
              </label>
            </p>

            <p>
              <label>
                Coin price{" "}
                <input
                  type="number"
                  min="0"
                  value={edit.coinPrice}
                  onChange={(event) => setEdit({ ...edit, coinPrice: Number(event.target.value) })}
                />
              </label>
            </p>

            <p>
              <label>
                Required student level{" "}
                <input
                  type="number"
                  min="1"
                  value={edit.requiredLevel}
                  onChange={(event) =>
                    setEdit({ ...edit, requiredLevel: Number(event.target.value) })
                  }
                />
              </label>
            </p>

            <label>
              <input
                type="checkbox"
                checked={edit.available}
                onChange={(event) => setEdit({ ...edit, available: event.target.checked })}
              />{" "}
              Available to students
            </label>

            <p>
              <button disabled={busy}>Save item</button>{" "}
              <button type="button" onClick={() => setEdit(null)}>
                Cancel
              </button>
            </p>
          </form>
        </div>
      )}

      <p role="status">{message}</p>
    </main>
  );
}
