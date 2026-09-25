/**
 * Shared helpers for the seed scripts (test/demo data only, never production).
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contestUsers, users } from "@/lib/db/schema";

export function pdfEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "-");
}

/** Minimal valid multi-page PDF with text lines (Helvetica). */
export function makePdf(title: string, pages: string[][]): Buffer {
  const objs: string[] = [];
  const pageIds: number[] = [];
  // 1 catalog, 2 pages, 3 font, then per page: page obj + content obj
  let next = 4;
  const pageObjs: string[] = [];
  for (const lines of pages) {
    const pageId = next++;
    const contentId = next++;
    pageIds.push(pageId);
    const body = [
      "BT",
      "/F1 26 Tf",
      "60 520 Td",
      `(${pdfEscape(lines[0] ?? title)}) Tj`,
      "/F1 15 Tf",
      ...lines.slice(1).flatMap((l) => ["0 -30 Td", `(${pdfEscape(l)}) Tj`]),
      "ET",
    ].join("\n");
    pageObjs[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageObjs[contentId] = `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`;
  }
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  for (let i = 4; i < next; i++) objs[i] = pageObjs[i];

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < next; i++) {
    offsets[i] = Buffer.byteLength(out);
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${next}\n0000000000 65535 f \n`;
  for (let i = 1; i < next; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${next} /Root 1 0 R /Info << /Title (${pdfEscape(title)}) >> >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** Helpers bound to a password (for every seeded account) and an uploads dir. */
export function createSeedKit(opts: { password: string; uploadsDir: string }) {
  async function saveUpload(kind: string, ext: string, data: Buffer): Promise<string> {
    await fs.mkdir(opts.uploadsDir, { recursive: true });
    const key = `${kind}_seed_${crypto.randomBytes(8).toString("hex")}.${ext}`;
    await fs.writeFile(path.join(opts.uploadsDir, key), data);
    return `/uploads/${key}`;
  }

  async function upsertUser(email: string, name: string, extra: Partial<typeof users.$inferInsert> = {}) {
    const lower = email.toLowerCase();
    const existing = await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${lower}` });
    if (existing) {
      if (extra.department !== undefined && extra.department !== existing.department) {
        await db.update(users).set({ department: extra.department }).where(eq(users.id, existing.id));
      }
      return existing;
    }
    const [u] = await db
      .insert(users)
      .values({
        email: lower,
        name,
        password: await bcrypt.hash(opts.password, 10),
        userType: "external",
        department: extra.department ?? null,
        ...extra,
      })
      .returning();
    return u;
  }

  async function enrol(
    contestId: string,
    userId: string,
    role: string,
    participantRole: string | null = null,
    teamId: string | null = null,
    extraRoles: string[] | null = null,
  ) {
    const existing = await db.query.contestUsers.findFirst({
      where: and(eq(contestUsers.contestId, contestId), eq(contestUsers.userId, userId)),
    });
    if (existing) {
      await db.update(contestUsers).set({ role, participantRole, teamId, extraRoles }).where(eq(contestUsers.id, existing.id));
      return existing.id;
    }
    const [row] = await db.insert(contestUsers).values({ contestId, userId, role, participantRole, teamId, extraRoles }).returning();
    return row.id;
  }

  return { saveUpload, upsertUser, enrol };
}
