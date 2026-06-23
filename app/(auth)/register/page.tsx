import React from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return <RegisterForm />;
}
