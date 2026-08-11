"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ASSIGNMENT_COOKIE } from "./queries";

export const setActiveAssignment = async (formData: FormData): Promise<void> => {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  (await cookies()).set(ASSIGNMENT_COOKIE, assignmentId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  revalidatePath("/", "layout");
};
