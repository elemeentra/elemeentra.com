"use client";

import { useEffect } from "react";
import { installMutationInvalidation } from "@/lib/admin-cache";

/** Mounted once in the admin layout: keeps the client data cache honest after writes. */
export function AdminBoot() {
  useEffect(() => installMutationInvalidation(), []);
  return null;
}
