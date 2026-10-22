import { revalidatePath } from "next/cache"

export function revalidateSettings(...sections: string[]) {
  revalidatePath("/settings", "layout")
  for (const section of sections) {
    if (section) revalidatePath(`/settings/${section}`)
  }
}
