"use server";

// The license tier templates (PLAN.md §3): name, description, default price,
// limits and terms of each tier. The admin calls it, so requireAdmin()
// comes first.
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import {
  invalidForm,
  licenseTierFormSchema,
  type FormResult,
} from "@/lib/validators";

// The default price is what new beats start at; existing beats keep their
// own price (/admin/beats/[id]). Past orders keep the license name they
// bought (OrderItem.licenseNameSnapshot).
export async function updateLicenseTier(
  _previous: FormResult | undefined,
  formData: FormData,
): Promise<FormResult> {
  await requireAdmin();
  const input = licenseTierFormSchema.safeParse({
    tierId: formData.get("tierId"),
    name: formData.get("name"),
    description: formData.get("description"),
    defaultPrice: formData.get("defaultPrice"),
    streamLimit: formData.get("streamLimit"),
    videoLimit: formData.get("videoLimit"),
    terms: formData.get("terms"),
  });
  if (!input.success) return invalidForm(input.error);
  const { tierId, defaultPrice, ...fields } = input.data;

  const { count } = await db.licenseTier.updateMany({
    where: { id: tierId },
    data: { ...fields, defaultPriceCents: defaultPrice },
  });
  if (count === 0) return { ok: false, message: "This tier no longer exists." };
  refresh();
  return { ok: true, message: "Saved." };
}
