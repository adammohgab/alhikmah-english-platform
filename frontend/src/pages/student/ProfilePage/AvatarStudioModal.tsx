import { useEffect, useMemo, useState } from "react";
import { Check, Lock, RotateCcw, Sparkles } from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { useToast } from "@/shared/hooks/useToast";
import { Button } from "@/shared/components/ui/Button";
import { Dialog } from "@/shared/components/ui/Dialog";

type Category = "Head" | "Hair" | "Eyes/Glasses" | "Accessories" | "Outfits" | "Background";
type Slot = "head" | "hair" | "eyes" | "accessory" | "outfit" | "background";
type AvatarConfig = Record<Slot, string>;
interface AvatarOption {
  id: string;
  label: string;
  level: number;
  color: string;
  detail?: string;
}

const CATEGORIES: { label: Category; slot: Slot }[] = [
  { label: "Head", slot: "head" },
  { label: "Hair", slot: "hair" },
  { label: "Eyes/Glasses", slot: "eyes" },
  { label: "Accessories", slot: "accessory" },
  { label: "Outfits", slot: "outfit" },
  { label: "Background", slot: "background" },
];

const OPTIONS: Record<Slot, AvatarOption[]> = {
  head: [
    { id: "skin-warm", label: "Warm", level: 1, color: "#D99A70" },
    { id: "skin-peach", label: "Peach", level: 1, color: "#F0BE98" },
    { id: "skin-deep", label: "Deep", level: 1, color: "#8D563C" },
    { id: "skin-olive", label: "Olive", level: 5, color: "#C99A68" },
    { id: "skin-rose", label: "Rose", level: 12, color: "#F2B7AE" },
  ],
  hair: [
    { id: "hair-dark", label: "Classic", level: 1, color: "#33213A", detail: "short" },
    { id: "hair-brown", label: "Chestnut", level: 1, color: "#75452D", detail: "swept" },
    { id: "hair-curls", label: "Curly", level: 3, color: "#251D2A", detail: "curly" },
    { id: "hair-blue", label: "Electric blue", level: 8, color: "#315CDE", detail: "swept" },
    { id: "hair-pink", label: "Candy pink", level: 15, color: "#E94F9B", detail: "curly" },
    { id: "hair-silver", label: "Silver", level: 25, color: "#A9B4C8", detail: "short" },
  ],
  eyes: [
    { id: "eyes-none", label: "No glasses", level: 1, color: "#33213A", detail: "none" },
    { id: "eyes-round", label: "Round frames", level: 1, color: "#30234B", detail: "round" },
    { id: "eyes-square", label: "Square frames", level: 4, color: "#5B3DF5", detail: "square" },
    { id: "eyes-shades", label: "Sun shades", level: 10, color: "#1B1740", detail: "shades" },
    { id: "eyes-gold", label: "Gold frames", level: 18, color: "#D6A52B", detail: "round" },
  ],
  accessory: [
    { id: "accessory-none", label: "No accessory", level: 1, color: "#FFFFFF", detail: "none" },
    { id: "accessory-cap", label: "Street cap", level: 1, color: "#FF5D8F", detail: "cap" },
    { id: "accessory-star", label: "Star clip", level: 5, color: "#FFC233", detail: "star" },
    { id: "accessory-halo", label: "Glow halo", level: 14, color: "#17B890", detail: "halo" },
    { id: "accessory-crown", label: "Mini crown", level: 22, color: "#FFC233", detail: "crown" },
  ],
  outfit: [
    { id: "outfit-violet", label: "Violet hoodie", level: 1, color: "#5B3DF5" },
    { id: "outfit-mint", label: "Mint jacket", level: 1, color: "#17B890" },
    { id: "outfit-coral", label: "Coral tee", level: 4, color: "#FF5D8F" },
    { id: "outfit-sky", label: "Sky varsity", level: 9, color: "#3DA9FF" },
    { id: "outfit-gold", label: "Golden bomber", level: 16, color: "#D6A52B" },
    { id: "outfit-neon", label: "Neon gamer", level: 28, color: "#9C4DFF" },
  ],
  background: [
    { id: "bg-lilac", label: "Lilac studio", level: 1, color: "#EDE7FF" },
    { id: "bg-sunrise", label: "Sunrise", level: 1, color: "#FFE8C7" },
    { id: "bg-mint", label: "Mint pop", level: 3, color: "#D6F7EC" },
    { id: "bg-night", label: "Night sky", level: 10, color: "#27264D" },
    { id: "bg-candy", label: "Candy arcade", level: 20, color: "#FFD6E7" },
  ],
};

const DEFAULT_CONFIG: AvatarConfig = {
  head: "skin-warm",
  hair: "hair-dark",
  eyes: "eyes-none",
  accessory: "accessory-none",
  outfit: "outfit-violet",
  background: "bg-lilac",
};

function optionFor(slot: Slot, id: string) {
  return OPTIONS[slot].find((option) => option.id === id) ?? OPTIONS[slot][0];
}

function configFromAvatarUrl(url: string | null): AvatarConfig {
  if (!url?.startsWith("data:image/svg+xml,")) return DEFAULT_CONFIG;
  try {
    const svg = decodeURIComponent(url.slice("data:image/svg+xml,".length));
    const match = /data-avatar-config="([^"]+)"/.exec(svg);
    if (!match) return DEFAULT_CONFIG;
    const parsed = JSON.parse(decodeURIComponent(match[1])) as Partial<AvatarConfig>;
    return Object.fromEntries(
      CATEGORIES.map(({ slot }) => [
        slot,
        OPTIONS[slot].some((option) => option.id === parsed[slot])
          ? parsed[slot]
          : DEFAULT_CONFIG[slot],
      ]),
    ) as AvatarConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function buildAvatarSvg(config: AvatarConfig): string {
  const head = optionFor("head", config.head);
  const hair = optionFor("hair", config.hair);
  const eyes = optionFor("eyes", config.eyes);
  const accessory = optionFor("accessory", config.accessory);
  const outfit = optionFor("outfit", config.outfit);
  const background = optionFor("background", config.background);
  const hairShape =
    hair.detail === "curly"
      ? `<g fill="${hair.color}"><circle cx="67" cy="47" r="17"/><circle cx="82" cy="36" r="18"/><circle cx="101" cy="36" r="17"/><circle cx="116" cy="47" r="16"/></g>`
      : hair.detail === "swept"
        ? `<path d="M57 61 Q48 20 88 19 Q124 17 126 55 L111 46 Q95 32 75 47 Z" fill="${hair.color}"/>`
        : `<path d="M57 59 Q50 22 85 20 Q121 17 124 56 L113 49 L108 36 L97 46 L88 33 L75 45 L66 42 Z" fill="${hair.color}"/>`;
  const glasses =
    eyes.detail === "none"
      ? ""
      : eyes.detail === "shades"
        ? `<path d="M59 61 Q73 55 86 62 L84 73 Q70 78 63 69 Z M94 62 Q107 55 121 61 L117 70 Q107 78 96 72 Z" fill="${eyes.color}"/><path d="M85 64 Q90 61 95 64" stroke="${eyes.color}" stroke-width="4" fill="none"/>`
        : `<g fill="none" stroke="${eyes.color}" stroke-width="4"><rect x="59" y="57" width="25" height="19" rx="${eyes.detail === "round" ? 10 : 3}"/><rect x="96" y="57" width="25" height="19" rx="${eyes.detail === "round" ? 10 : 3}"/><path d="M84 63 Q90 59 96 63"/></g>`;
  let headAccessory = "";
  if (accessory.detail === "cap")
    headAccessory = `<path d="M54 43 Q60 16 91 22 Q115 23 121 44 Z" fill="${accessory.color}" stroke="#1B1740" stroke-width="3"/><path d="M88 43 Q112 38 131 48 Q113 54 88 48 Z" fill="${accessory.color}" stroke="#1B1740" stroke-width="3"/>`;
  if (accessory.detail === "star")
    headAccessory = `<path d="M119 27 L123 36 L133 37 L126 44 L128 54 L119 49 L110 54 L112 44 L105 37 L115 36 Z" fill="${accessory.color}" stroke="#1B1740" stroke-width="2"/>`;
  if (accessory.detail === "halo")
    headAccessory = `<ellipse cx="91" cy="17" rx="26" ry="7" fill="none" stroke="${accessory.color}" stroke-width="5"/>`;
  if (accessory.detail === "crown")
    headAccessory = `<path d="M67 31 L62 13 L78 23 L91 7 L104 23 L120 13 L115 32 Z" fill="${accessory.color}" stroke="#1B1740" stroke-width="3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" role="img" aria-label="Customized student avatar" data-avatar-config="${encodeURIComponent(JSON.stringify(config))}"><rect width="180" height="180" rx="26" fill="${background.color}"/><circle cx="22" cy="25" r="3" fill="#FFFFFF" opacity=".7"/><circle cx="155" cy="118" r="5" fill="#FFFFFF" opacity=".65"/><path d="M32 180 Q35 127 72 125 L110 125 Q147 130 150 180 Z" fill="${outfit.color}" stroke="#1B1740" stroke-width="3"/><path d="M76 119 L91 137 L106 119" fill="#FFFFFF" opacity=".85"/><rect x="81" y="103" width="20" height="27" rx="8" fill="${head.color}"/><ellipse cx="91" cy="69" rx="37" ry="44" fill="${head.color}" stroke="#1B1740" stroke-width="3"/>${hairShape}<ellipse cx="77" cy="70" rx="3.5" ry="4.5" fill="#1B1740"/><ellipse cx="105" cy="70" rx="3.5" ry="4.5" fill="#1B1740"/>${glasses}<path d="M83 89 Q91 95 99 88" fill="none" stroke="#8C4C43" stroke-width="3" stroke-linecap="round"/>${headAccessory}<path d="M75 150 L91 160 L107 150" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".8"/></svg>`;
}

function avatarDataUrl(config: AvatarConfig) {
  return `data:image/svg+xml,${encodeURIComponent(buildAvatarSvg(config))}`;
}

export interface AvatarStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLevel: number;
  avatarUrl: string | null;
  onSaved: (avatarUrl: string) => void;
}

export default function AvatarStudioModal({
  open,
  onOpenChange,
  currentLevel,
  avatarUrl,
  onSaved,
}: AvatarStudioModalProps) {
  const toast = useToast();
  const [category, setCategory] = useState<Category>("Head");
  const [config, setConfig] = useState<AvatarConfig>(() => configFromAvatarUrl(avatarUrl));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const activeCategory = CATEGORIES.find((item) => item.label === category) ?? CATEGORIES[0];
  const options = OPTIONS[activeCategory.slot];
  const previewUrl = useMemo(() => avatarDataUrl(config), [config]);

  useEffect(() => {
    if (open) {
      setConfig(configFromAvatarUrl(avatarUrl));
      setCategory("Head");
      setSaveError(null);
    }
  }, [open, avatarUrl]);

  const choose = (option: AvatarOption) => {
    if (option.level > currentLevel) return;
    setConfig((previous) => ({ ...previous, [activeCategory.slot]: option.id }));
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.rpc("save_student_avatar", { p_avatar_url: previewUrl });
    setSaving(false);
    if (error) {
      setSaveError(error.message || "Your avatar could not be saved. Try again.");
      toast.show({
        title: "Could not save avatar",
        description: "Check your connection and try again.",
        type: "error",
      });
      return;
    }
    onSaved(previewUrl);
    toast.show({ title: "Avatar saved", description: "Your new look is ready.", type: "success" });
    onOpenChange(false);
  };

  const reset = () => setConfig(DEFAULT_CONFIG);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Avatar studio"
      description="Mix and match your look. Items unlock as you level up."
      size="lg"
      className="w-[calc(100vw-1rem)] sm:w-full"
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section
          className="flex flex-col items-center gap-3 rounded-2xl border-2 border-stroke bg-[var(--world-tint,#fff8db)] p-4"
          aria-label="Live avatar preview"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <span className="font-heading text-sm font-bold">Live preview</span>
            <span className="rounded-full border-2 border-stroke bg-white px-2.5 py-1 text-xs font-bold">
              Level {currentLevel}
            </span>
          </div>
          <div
            className="w-full max-w-[250px] overflow-hidden rounded-[26px] border-2 border-stroke bg-white shadow-[4px_4px_0px_#1A1530]"
            aria-live="polite"
            key={previewUrl}
          >
            <svg
              viewBox="0 0 180 180"
              className="block h-auto w-full"
              role="img"
              aria-label="Your avatar preview"
              dangerouslySetInnerHTML={{
                __html: buildAvatarSvg(config).replace(/^<svg[^>]*>|<\/svg>$/g, ""),
              }}
            />
          </div>
          <p className="text-muted-foreground text-center text-xs">
            Your choices update instantly.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={reset}>
            <RotateCcw size={15} aria-hidden="true" /> Reset look
          </Button>
        </section>
        <section className="min-w-0">
          <div
            role="tablist"
            aria-label="Avatar categories"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {CATEGORIES.map((item) => (
              <button
                key={item.slot}
                type="button"
                role="tab"
                aria-selected={category === item.label}
                onClick={() => setCategory(item.label)}
                className={`min-h-11 rounded-xl border-2 px-2 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--world-main,#ffd23f)] ${category === item.label ? "border-stroke bg-[var(--world-soft,#ffea94)] shadow-[2px_2px_0px_#1A1530]" : "border-stroke/30 bg-white hover:bg-[var(--world-tint,#fff8db)]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <h3 className="font-heading text-lg font-bold">Choose {category.toLowerCase()}</h3>
            <span className="text-muted-foreground text-xs">
              {options.filter((option) => option.level <= currentLevel).length} available
            </span>
          </div>
          <div className="mt-3 grid max-h-[34vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:max-h-[42vh]">
            {options.map((option) => {
              const locked = option.level > currentLevel;
              const selected = config[activeCategory.slot] === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={locked}
                  onClick={() => choose(option)}
                  aria-pressed={selected}
                  className={`relative flex min-h-[94px] flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--world-main,#ffd23f)] disabled:cursor-not-allowed ${selected ? "border-stroke bg-[var(--world-soft,#ffea94)] shadow-[2px_2px_0px_#1A1530]" : locked ? "text-muted-foreground border-stroke/20 bg-surface-100" : "border-stroke/30 bg-white hover:border-stroke hover:bg-[var(--world-tint,#fff8db)]"}`}
                >
                  {selected && (
                    <span className="absolute right-2 top-2 rounded-full bg-white p-1">
                      <Check size={13} aria-label="Selected" />
                    </span>
                  )}
                  {locked && (
                    <span className="absolute right-2 top-2 rounded-full bg-white p-1">
                      <Lock size={13} aria-label="Locked" />
                    </span>
                  )}
                  <span
                    className="h-8 w-8 rounded-full border-2 border-stroke/20"
                    style={{ backgroundColor: option.color }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-bold">{option.label}</span>
                  {locked ? (
                    <span className="text-xs font-semibold">Unlocks at level {option.level}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {selected ? "Equipped" : "Tap to equip"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="text-muted-foreground mt-3 flex items-start gap-2 rounded-xl bg-[var(--world-tint,#fff8db)] p-3 text-xs">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-stroke" aria-hidden="true" />
            <p>
              Locked styles are earned through learning. Keep completing lessons to unlock more
              choices.
            </p>
          </div>
        </section>
      </div>
      {saveError && (
        <p
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger mt-4 rounded-lg border p-3 text-sm font-semibold"
        >
          {saveError}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t-2 border-stroke/10 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="button" onClick={() => void save()} loading={saving} disabled={saving}>
          <Check size={16} aria-hidden="true" /> Save avatar
        </Button>
      </div>
    </Dialog>
  );
}
