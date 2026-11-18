import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/pricing";
import type { FileType } from "@/generated/prisma/client";

const fileNames = { MP3: "MP3", WAV: "WAV", STEMS: "Stems (ZIP)" } as const;

export type OrderListItem = {
  id: string;
  beatTitleSnapshot: string;
  licenseNameSnapshot: string;
  priceCents: number;
  refundNeeded: boolean;
  downloads: { fileType: FileType; count: number; maxCount: number }[];
};

// The items of one order, used by the success page and /account.
// With `showDownloads`, each file gets a Download button and its count.
// `token` is the guest download token: the success page adds it to the
// links, /account doesn't need it because the download route checks the
// signed-in owner instead.
export function OrderItemList({
  items,
  showDownloads,
  token,
}: {
  items: OrderListItem[];
  showDownloads: boolean;
  token?: string;
}) {
  const query = token ? `?token=${token}` : "";

  return (
    <ul className="flex flex-col divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1 py-3">
          <div className="flex justify-between gap-3">
            <span className="font-medium">
              {item.beatTitleSnapshot} · {item.licenseNameSnapshot}
            </span>
            <span>{formatPrice(item.priceCents)}</span>
          </div>
          {item.refundNeeded ? (
            <p className="text-sm text-destructive">
              Another buyer got this exclusive just before your payment went
              through. This item is refunded in full.
            </p>
          ) : showDownloads ? (
            <ul className="flex flex-col gap-2 pt-1">
              {item.downloads.map((download) => (
                <li
                  key={download.fileType}
                  className="flex items-center justify-between gap-3"
                >
                  {/* A plain <a>, not <Link>: Next can prefetch a Link,
                      and fetching this URL counts as a download. */}
                  <a
                    href={`/api/download/${item.id}/${download.fileType}${query}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Download {fileNames[download.fileType]}
                  </a>
                  <span className="text-sm text-muted-foreground">
                    {Math.max(download.maxCount - download.count, 0)} of{" "}
                    {download.maxCount} downloads left
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Files:{" "}
              {item.downloads
                .map((download) => fileNames[download.fileType])
                .join(", ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
