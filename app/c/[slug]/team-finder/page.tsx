"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { uploadFile } from "@/lib/uploads/client";

type Pitch = {
  id: string;
  title: string;
  bioMarkdown: string | null;
  skills: string[] | null;
  heroMediaUrl: string | null;
  videoUrl: string | null;
  imageUrls: string[] | null;
  lookingForRoles: string[] | null;
  user: { id: string; name: string | null; email: string; department: string | null } | null;
};

export default function TeamFinderPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(false);

  const [myPitch, setMyPitch] = useState<{
    title: string;
    bioMarkdown: string;
    skills: string;
    lookingForRoles: string;
    videoUrl: string;
    imageUrls: string[];
  }>({
    title: "",
    bioMarkdown: "",
    skills: "",
    lookingForRoles: "",
    videoUrl: "",
    imageUrls: [],
  });

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/c/${slug}/pitches`);
      if (res.ok) {
        const data = (await res.json()) as { pitches: Pitch[] };
        setPitches(data.pitches);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [slug]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return pitches;
    const q = filter.toLowerCase();
    return pitches.filter((p) => {
      const haystack = [
        p.title,
        p.user?.name,
        p.user?.department,
        ...(p.skills ?? []),
        ...(p.lookingForRoles ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [pitches, filter]);

  async function submitMyPitch() {
    const res = await fetch(`/api/c/${slug}/pitches`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: myPitch.title,
        bioMarkdown: myPitch.bioMarkdown,
        skills: myPitch.skills.split(",").map((s) => s.trim()).filter(Boolean),
        lookingForRoles: myPitch.lookingForRoles.split(",").map((s) => s.trim()).filter(Boolean),
        videoUrl: myPitch.videoUrl || undefined,
        imageUrls: myPitch.imageUrls,
      }),
    });
    if (res.ok) {
      setEditing(false);
      await reload();
    } else {
      alert("Failed to save pitch");
    }
  }

  async function onImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { publicUrl } = await uploadFile({ file: f, kind: "pitch_image" });
      setMyPitch((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, publicUrl] }));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Team Finder</h1>
          <button
            onClick={() => setEditing((e) => !e)}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500"
          >
            {editing ? "Cancel" : "Publish / Edit my pitch"}
          </button>
        </div>
        <p className="mt-2 text-slate-400">
          Browse people looking for teams. Publish your own pitch to get invited.
        </p>

        {editing && (
          <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Your pitch</h2>
            <div className="mt-3 grid gap-3">
              <input
                className="rounded-md bg-slate-900 px-3 py-2 text-sm"
                placeholder="Headline (e.g. Full-stack dev looking for a frontend-heavy team)"
                value={myPitch.title}
                onChange={(e) => setMyPitch((p) => ({ ...p, title: e.target.value }))}
              />
              <textarea
                className="min-h-[120px] rounded-md bg-slate-900 px-3 py-2 text-sm"
                placeholder="Bio (Markdown supported)"
                value={myPitch.bioMarkdown}
                onChange={(e) => setMyPitch((p) => ({ ...p, bioMarkdown: e.target.value }))}
              />
              <input
                className="rounded-md bg-slate-900 px-3 py-2 text-sm"
                placeholder="Skills (comma-separated)"
                value={myPitch.skills}
                onChange={(e) => setMyPitch((p) => ({ ...p, skills: e.target.value }))}
              />
              <input
                className="rounded-md bg-slate-900 px-3 py-2 text-sm"
                placeholder="Looking for teams with (comma-separated)"
                value={myPitch.lookingForRoles}
                onChange={(e) => setMyPitch((p) => ({ ...p, lookingForRoles: e.target.value }))}
              />
              <input
                className="rounded-md bg-slate-900 px-3 py-2 text-sm"
                placeholder="Video URL (YouTube, Vimeo, etc.) — optional"
                value={myPitch.videoUrl}
                onChange={(e) => setMyPitch((p) => ({ ...p, videoUrl: e.target.value }))}
              />
              <label className="text-sm text-slate-300">
                Add image
                <input type="file" accept="image/*" onChange={onImageFile} className="mt-1 block text-sm" />
              </label>
              {myPitch.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {myPitch.imageUrls.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="pitch" className="h-16 w-16 rounded object-cover" />
                  ))}
                </div>
              )}
              <button
                onClick={submitMyPitch}
                disabled={!myPitch.title}
                className="mt-2 self-start rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-emerald-500"
              >
                Save pitch
              </button>
            </div>
          </section>
        )}

        <div className="mt-6">
          <input
            className="w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Filter by skill, role, name..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="mt-10 text-center text-slate-400">Loading pitches…</div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 text-center text-slate-400">
            No pitches yet. Be the first to publish yours.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <article
                key={p.id}
                className="rounded-xl border border-white/10 bg-white/5 p-5"
              >
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <div className="mt-1 text-sm text-slate-400">
                  {p.user?.name} · {p.user?.department ?? "—"}
                </div>
                {p.bioMarkdown && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300 line-clamp-6">
                    {p.bioMarkdown}
                  </p>
                )}
                {p.skills && p.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {p.lookingForRoles && p.lookingForRoles.length > 0 && (
                  <div className="mt-2 text-xs text-slate-400">
                    Looking for: {p.lookingForRoles.join(", ")}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
