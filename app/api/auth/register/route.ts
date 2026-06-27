import { db } from "@/lib/db";
import { mUsers } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, password } = body;
    
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Missing required fields: email, name, password" },
        { status: 400 }
      );
    }
    
    // Check if user already exists
    const existingUser = await db.query.mUsers.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create user (no company associated initially, they will setup company next)
    const [newUser] = await db.insert(mUsers).values({
      name,
      email,
      passwordHash,
      role: "company",
      isActive: true,
    }).returning({ id: mUsers.id, name: mUsers.name, email: mUsers.email });
    
    return NextResponse.json(
      { message: "Registration successful", user: newUser },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to register" },
      { status: 500 }
    );
  }
}
