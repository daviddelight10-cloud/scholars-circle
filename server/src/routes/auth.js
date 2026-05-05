import express from "express";

import bcrypt from "bcryptjs";

import jwt from "jsonwebtoken";

import { z } from "zod";

import { prisma } from "../db.js";

import { generateActivationKey } from "./keys.js";



const router = express.Router();



const registerSchema = z.object({
  email: z.string().trim().email(),
  username: z.string().trim().min(3),
  password: z.string().min(6),
  role: z.enum(["STUDENT", "TEACHER"]).optional(),
  inviteCode: z.string().optional(),
});



router.post("/register", async (req, res) => {
  console.log("Register request body:", JSON.stringify(req.body));
  try {
    const data = registerSchema.parse(req.body);

    const desiredRole = data.role || "STUDENT";

    if (desiredRole === "TEACHER") {

      const expected = process.env.TEACHER_INVITE_CODE || "";

      if (!expected || data.inviteCode !== expected) {

        return res.status(403).json({ error: "Invalid teacher invite code" });

      }

    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    // Generate unique activation key for students
    let activationKey = null;
    if (desiredRole === "STUDENT") {
      // Ensure uniqueness
      let unique = false;
      while (!unique) {
        activationKey = generateActivationKey();
        const existing = await prisma.user.findUnique({ where: { activationKey } });
        if (!existing) unique = true;
      }
    }

    const user = await prisma.user.create({

      data: {

        email: data.email,

        username: data.username,

        passwordHash,

        role: desiredRole,

        activationKey,

        isActivated: desiredRole === "TEACHER",

      },

    });

    return res.status(201).json({ id: user.id, username: user.username, role: user.role, activationKey: user.activationKey, isActivated: user.isActivated });

  } catch (e) {
    console.error("Registration error:", e);

    if (e.code === "P2002") {
      const target = e.meta?.target || [];
      const field = Array.isArray(target) && target.includes("email") ? "email" : "username";
      return res.status(400).json({ error: `An account with that ${field} already exists. Please use a different ${field} or log in.` });
    }

    return res.status(400).json({ error: "Registration failed", details: e.message });

  }

});



router.post("/login", async (req, res) => {
  console.log("Login request body:", JSON.stringify(req.body));
  const schema = z.object({ login: z.string(), password: z.string() });
  try {
    const { login, password } = schema.parse(req.body);

    const user = await prisma.user.findFirst({

      where: { OR: [{ email: login }, { username: login }] },

    });

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);

    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    await prisma.loginEvent

      .create({

        data: {

          userId: user.id,

          ip: req.ip || null,

          userAgent: req.headers["user-agent"] || null,

        },

      })

      .catch(() => {});

    const token = jwt.sign({ sub: user.id, role: user.role, username: user.username, isActivated: user.isActivated }, process.env.JWT_SECRET, {

      expiresIn: "7d",

    });

    return res.json({ token, user: { id: user.id, username: user.username, role: user.role, activationKey: user.activationKey, isActivated: user.isActivated } });

  } catch (e) {
    console.error("Login error:", e);
    return res.status(400).json({ error: "Login failed", details: e.message });
  }

});



export default router;

