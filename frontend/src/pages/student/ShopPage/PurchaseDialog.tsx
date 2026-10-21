import { Coins } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { Dialog } from "@/shared/components/ui/Dialog";
import type { ShopItem } from "./api";

/* Confirmation before spending coins: shows the balance before and after checkout. */

export interface PurchaseDialogProps {
  item: ShopItem | null;
  coins: number;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PurchaseDialog({
  item,
  coins,
  busy,
  error,
  onConfirm,
  onCancel,
}: PurchaseDialogProps) {
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
      title={item ? `Buy ${item.name}?` : "Buy item"}
      description={
        item ? `This costs ${item.price.toLocaleString()} coins and cannot be refunded.` : undefined
      }
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={busy}>
            Buy for {item?.price.toLocaleString()}
          </Button>
        </>
      }
    >
      {item && (
        <dl className="flex flex-col gap-2 text-[16px] text-stroke">
          <div className="flex items-center justify-between">
            <dt>Your coins now</dt>
            <dd className="flex items-center gap-1 font-bold">
              <Coins size={16} aria-hidden="true" />
              {coins.toLocaleString()}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt>Price</dt>
            <dd className="font-bold">-{item.price.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between border-t-2 border-stroke pt-2">
            <dt>After buying</dt>
            <dd className="flex items-center gap-1 font-bold">
              <Coins size={16} aria-hidden="true" />
              {(coins - item.price).toLocaleString()}
            </dd>
          </div>
        </dl>
      )}
      {error && (
        <p role="alert" className="text-danger mt-3 text-[14px] font-bold">
          {error}
        </p>
      )}
    </Dialog>
  );
}
