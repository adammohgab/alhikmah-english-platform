import React, { useMemo, useState } from "react";

export type AvatarPartCategory = "hairstyles" | "hats" | "glasses" | "shirts";
export interface AvatarPart {
  id: string;
  name: string;
  category: AvatarPartCategory;
  svg: string;
  layerOrder: number;
  available: boolean;
}

interface Props {
  assets: AvatarPart[];
  saveAsset: (asset: Omit<AvatarPart, "id"> & { id?: string }) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
}

const categories: AvatarPartCategory[] = ["hairstyles", "hats", "glasses", "shirts"];

function validateSvg(source: string): string {
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = doc.documentElement;

  if (root.localName !== "svg" || doc.querySelector("parsererror")) {
    throw new Error("Choose a valid SVG file.");
  }
  if (doc.querySelector("script,foreignObject,iframe,object,embed")) {
    throw new Error("SVG contains unsupported active content.");
  }

  for (const node of Array.from(doc.querySelectorAll("*"))) {
    for (const attr of Array.from(node.attributes)) {
      if (
        /^on/i.test(attr.name) ||
        ((attr.name === "href" || attr.name.endsWith(":href")) &&
          !attr.value.startsWith("#") &&
          !attr.value.startsWith("data:image/"))
      ) {
        throw new Error("SVG contains an event handler or external resource reference.");
      }
    }
  }

  return new XMLSerializer().serializeToString(root);
}

export default function AvatarStudioAdminPage({ assets, saveAsset, deleteAsset }: Props) {
  const [category, setCategory] = useState<AvatarPartCategory>("hairstyles");
  const [name, setName] = useState("");
  const [svg, setSvg] = useState("");
  const [layerOrder, setLayerOrder] = useState(20);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const visibleAssets = useMemo(
    () =>
      assets
        .filter((asset) => asset.category === category)
        .sort((a, b) => a.layerOrder - b.layerOrder),
    [assets, category],
  );

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!name.trim() || !svg.trim()) return;

    setBusy(true);
    try {
      const cleanSvg = validateSvg(svg);
      await saveAsset({
        name: name.trim(),
        category,
        svg: cleanSvg,
        layerOrder,
        available: true,
      });
      setName("");
      setSvg("");
      setMessage("Avatar asset saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the asset.");
    } finally {
      setBusy(false);
    }
  }

  async function selectFile(file?: File) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".svg") || file.size > 500_000) {
      setMessage("Select an SVG file smaller than 500 KB.");
      return;
    }

    try {
      setSvg(validateSvg(await file.text()));
      setMessage("SVG loaded. Review it and save to add it to the library.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read SVG.");
    }
  }

  async function move(asset: AvatarPart, delta: number) {
    const index = visibleAssets.findIndex((item) => item.id === asset.id);
    const target = index + delta;
    if (target < 0 || target >= visibleAssets.length) return;

    const reordered = [...visibleAssets];
    const moving = reordered[index];
    const displaced = reordered[target];
    if (moving === undefined || displaced === undefined) return;
    reordered[index] = displaced;
    reordered[target] = moving;

    setBusy(true);
    try {
      await Promise.all(
        reordered.map((item, order) => saveAsset({ ...item, layerOrder: (order + 1) * 10 })),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update layer order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 1050, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Avatar SVG Asset Studio</h1>
      <p>
        Upload modular SVG parts and set their draw order. SVGs are checked for active content and
        external references before saving.
      </p>

      <label>
        Asset category{" "}
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as AvatarPartCategory)}
        >
          {categories.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>

      <form
        onSubmit={(event) => {
          void upload(event);
        }}
        style={{ border: "1px solid #ddd", padding: 16, marginTop: 16 }}
      >
        <h2>Add {category}</h2>

        <p>
          <label>
            Asset name{" "}
            <input required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        </p>

        <p>
          <label>
            Layer order{" "}
            <input
              type="number"
              value={layerOrder}
              onChange={(event) => setLayerOrder(Number(event.target.value))}
            />
          </label>{" "}
          <small>Lower numbers render first.</small>
        </p>

        <p>
          <label>
            Upload SVG{" "}
            <input
              type="file"
              accept="image/svg+xml,.svg"
              onChange={(event) => void selectFile(event.target.files?.[0])}
            />
          </label>
        </p>

        <label>
          SVG source
          <textarea
            rows={8}
            style={{ display: "block", width: "100%", fontFamily: "monospace" }}
            value={svg}
            onChange={(event) => setSvg(event.target.value)}
            placeholder="Or paste SVG markup"
          />
        </label>

        {svg && (
          <div>
            <h3>Preview</h3>
            <div
              style={{ width: 150, height: 150, border: "1px solid #ddd" }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        )}

        <button disabled={busy || !name.trim() || !svg.trim()}>
          {busy ? "Saving…" : "Add asset"}
        </button>
      </form>

      <h2>Asset library · {category}</h2>
      {visibleAssets.map((asset, index) => (
        <article
          key={asset.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: 12,
            borderBottom: "1px solid #ddd",
          }}
        >
          <div style={{ width: 72, height: 72 }} dangerouslySetInnerHTML={{ __html: asset.svg }} />
          <div style={{ flex: 1 }}>
            <strong>{asset.name}</strong>
            <div>
              Layer order: {asset.layerOrder} · {asset.available ? "Available" : "Unavailable"}
            </div>
          </div>
          <button disabled={busy || index === 0} onClick={() => void move(asset, -1)}>
            Move earlier
          </button>
          <button
            disabled={busy || index === visibleAssets.length - 1}
            onClick={() => void move(asset, 1)}
          >
            Move later
          </button>
          <button
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  await deleteAsset(asset.id);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Delete failed.");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Delete
          </button>
        </article>
      ))}
      <p role="status">{message}</p>
    </main>
  );
}
