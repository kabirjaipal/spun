import { db } from "@/lib/db";
import { mUsers } from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// GET /api/users - List users
export async function GET() {
  try {
    const usersList = await db
      .select({
        id: mUsers.id,
        name: mUsers.name,
        email: mUsers.email,
        isActive: mUsers.isActive,
      })
      .from(mUsers)
      .where(isNull(mUsers.deletedOn));

    return NextResponse.json(usersList);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a user
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

    // Hash password using bcryptjs
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user using Drizzle ORM
    const [newUser] = await db
      .insert(mUsers)
      .values({
        email,
        name,
        passwordHash,
      })
      .returning({
        id: mUsers.id,
        name: mUsers.name,
        email: mUsers.email,
      });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
