"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, FileText, LogOut, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Article = {
  id: string;
  title: string;
  slug: string;
  snippet: string;
  content: string;
  category: string;
  status: string;
  image_url: string | null;
  likes_count: number;
  published_at: string | null;
};
type Ad = { id: string; title: string; image_url: string; target_url: string; position: string; is_active: boolean };
type AdminComment = { id: string; article_id: string; content: string; created_at: string };

const categories = ["Politics", "Sports", "Business", "Entertainment", "General"];
const publisher = "nextlevelmedia473@outlook.com";
const emptyArticle = { title: "", slug: "", snippet: "", content: "", category: "General", status: "draft", image_url: "" };
const emptyAd = { title: "", image_url: "", target_url: "", position: "sidebar" };

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [adForm, setAdForm] = useState(emptyAd);
  const [form, setForm] = useState(emptyArticle);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage("Your session could not be checked. Please sign in again.");
      setUser(data.user?.email ?? null);
      setAuthLoaded(true);
    }).catch((error: unknown) => {
      console.error("Could not check publisher session", error);
      if (active) {
        setMessage("Your session could not be checked. Please sign in again.");
        setAuthLoaded(true);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user.email ?? null);
      setAuthLoaded(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user === publisher) void loadData();
  }, [user]);

  async function loadData() {
    const [articleResult, adResult, commentResult] = await Promise.all([
      supabase.from("articles").select("*").order("created_at", { ascending: false }),
      supabase.from("ads").select("*").order("created_at", { ascending: false }),
      supabase.from("comments").select("id, article_id, content, created_at").order("created_at", { ascending: false }),
    ]);
    if (articleResult.error || adResult.error || commentResult.error) {
      console.error("Could not load publisher data", articleResult.error ?? adResult.error ?? commentResult.error);
      setMessage("Some newsroom data could not be loaded.");
    }
    if (articleResult.data) setArticles(articleResult.data as Article[]);
    if (adResult.data) setAds(adResult.data as Ad[]);
    if (commentResult.data) setComments(commentResult.data as AdminComment[]);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Publisher sign-in failed", error.message);
      setMessage("Login details could not be accepted.");
    } else {
      setUser(data.user.email ?? null);
      setMessage("");
    }
  }

  async function fetchLatestNews() {
    setFetching(true);
    setMessage("");
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session) {
        setMessage("Please sign in before fetching news.");
        return;
      }
      const response = await fetch("/api/cron/daily-ingest", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json() as { imported?: number; failed?: number; error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Latest news could not be fetched.");
        return;
      }
      const failed = payload.failed ?? 0;
      setMessage(`${payload.imported ?? 0} latest stories fetched and published.${failed ? ` ${failed} stories could not be saved.` : ""}`);
      await loadData();
    } catch (error) {
      console.error("Manual news ingestion failed", error);
      setMessage(error instanceof Error ? error.message : "Latest news could not be fetched.");
    } finally {
      setFetching(false);
    }
  }

  async function saveArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { error } = await supabase.from("articles").insert({
      ...form,
      image_url: form.image_url || null,
      published_at: form.status === "published" ? new Date().toISOString() : null,
    });
    if (error) {
      console.error("Could not save newsroom article", error.message);
      setMessage("The story could not be saved.");
      return;
    }
    setMessage("Story saved.");
    setForm(emptyArticle);
    await loadData();
  }

  async function saveAd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { error } = await supabase.from("ads").insert(adForm);
    if (error) {
      console.error("Could not save newsroom advertisement", error.message);
      setMessage("The ad could not be saved.");
      return;
    }
    setMessage("Ad saved.");
    setAdForm(emptyAd);
    await loadData();
  }

  async function removeArticle(id: string) {
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) {
      console.error("Could not delete newsroom article", error.message);
      setMessage("The story could not be deleted.");
      return;
    }
    setArticles((items) => items.filter((item) => item.id !== id));
  }

  async function removeAd(id: string) {
    const { error } = await supabase.from("ads").delete().eq("id", id);
    if (error) {
      console.error("Could not delete newsroom advertisement", error.message);
      setMessage("The ad could not be deleted.");
      return;
    }
    setAds((items) => items.filter((item) => item.id !== id));
  }

  async function removeComment(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) {
      console.error("Could not delete newsroom comment", error.message);
      setMessage("The comment could not be deleted.");
      return;
    }
    setComments((items) => items.filter((item) => item.id !== id));
  }

  if (!authLoaded) {
    return <main className="grid min-h-screen place-items-center bg-[#080e19] text-slate-300">Loading publisher access…</main>;
  }

  if (user !== publisher) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#080e19] px-4 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101a2b] p-7 shadow-2xl">
          <a href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to newsroom</a>
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600"><ShieldCheck /></div>
          <h1 className="text-3xl font-bold">Publisher login</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Manage publishing, news ingestion, advertisements and reader conversations.</p>
          <form onSubmit={login} className="mt-8 grid gap-4">
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Publisher email" className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm outline-none focus:border-blue-500" />
            <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm outline-none focus:border-blue-500" />
            <button className="rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-500">Sign in</button>
          </form>
          {message && <p role="alert" className="mt-4 text-sm text-rose-300">{message}</p>}
          <p className="mt-6 text-xs leading-5 text-slate-600">Only the designated publisher account can enter this area.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080e19] text-white">
      <header className="border-b border-white/10 bg-[#0b1322]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="flex items-center gap-3"><Image src="/hero.jpg" alt="" width={36} height={36} className="h-9 w-9 rounded-lg object-cover" /><span className="font-bold">Publisher newsroom</span></a>
          <div className="flex items-center gap-3 text-sm text-slate-400"><span className="hidden sm:block">{user}</span><button onClick={() => void supabase.auth.signOut()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-400">Publisher console</p><h1 className="mt-2 text-4xl font-bold">Good to see you.</h1></div>
          <div className="flex items-center gap-3">
            <button onClick={() => void fetchLatestNews()} disabled={fetching} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />{fetching ? "Fetching..." : "Fetch Latest News Now"}</button>
            <a href="/" className="hidden items-center gap-2 text-sm text-slate-400 hover:text-white sm:flex"><ArrowLeft className="h-4 w-4" /> View site</a>
          </div>
        </div>
        {message && <p role="status" className="mb-6 rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">{message}</p>}

        <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
          <form onSubmit={saveArticle} className="rounded-2xl border border-white/10 bg-[#101a2b] p-6">
            <div className="mb-5 flex items-center gap-3"><Plus className="h-5 w-5 text-blue-400" /><h2 className="text-xl font-bold">New story</h2></div>
            <div className="grid gap-3">
              <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value, slug: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") })} placeholder="Headline" className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm outline-none focus:border-blue-500" />
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded-xl border border-white/10 bg-[#162238] px-4 py-3 text-sm outline-none">{categories.map((item) => <option key={item}>{item}</option>)}</select>
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="rounded-xl border border-white/10 bg-[#162238] px-4 py-3 text-sm outline-none"><option value="draft">Draft</option><option value="published">Publish now</option><option value="scheduled">Scheduled</option></select>
              </div>
              <input value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} placeholder="Image URL (optional)" className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm outline-none focus:border-blue-500" />
              <textarea required value={form.snippet} onChange={(event) => setForm({ ...form, snippet: event.target.value })} placeholder="Short excerpt" rows={3} className="resize-none rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm outline-none focus:border-blue-500" />
              <textarea required value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Full story" rows={8} className="resize-y rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm outline-none focus:border-blue-500" />
              <button className="rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-500">Save story</button>
            </div>
          </form>

          <div className="grid content-start gap-6">
            <section className="rounded-2xl border border-white/10 bg-[#101a2b] p-6">
              <div className="mb-5 flex items-center gap-3"><FileText className="h-5 w-5 text-cyan-400" /><h2 className="text-xl font-bold">Stories</h2><span className="ml-auto rounded-full bg-white/10 px-3 py-1 text-xs text-slate-400">{articles.length}</span></div>
              <div className="grid max-h-[32rem] gap-3 overflow-y-auto">
                {articles.map((article) => <div key={article.id} className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider"><span className="text-blue-400">{article.category}</span><span className="text-slate-600">{article.status}</span></div><h3 className="font-semibold">{article.title}</h3><p className="mt-1 line-clamp-2 text-xs text-slate-500">{article.snippet}</p></div><button onClick={() => void removeArticle(article.id)} aria-label={`Delete ${article.title}`} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}
                {!articles.length && <p className="py-8 text-center text-sm text-slate-500">No stories yet.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#101a2b] p-6">
              <h2 className="mb-5 text-xl font-bold">Advertisements</h2>
              <form onSubmit={saveAd} className="grid gap-3 sm:grid-cols-2">
                <input required value={adForm.title} onChange={(event) => setAdForm({ ...adForm, title: event.target.value })} placeholder="Ad title" className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm outline-none focus:border-blue-500" />
                <select value={adForm.position} onChange={(event) => setAdForm({ ...adForm, position: event.target.value })} className="rounded-xl border border-white/10 bg-[#162238] px-4 py-3 text-sm outline-none"><option value="sidebar">Sidebar</option><option value="header_banner">Header banner</option><option value="in_article">In article</option></select>
                <input required type="url" value={adForm.image_url} onChange={(event) => setAdForm({ ...adForm, image_url: event.target.value })} placeholder="Image URL" className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm outline-none focus:border-blue-500" />
                <input required type="url" value={adForm.target_url} onChange={(event) => setAdForm({ ...adForm, target_url: event.target.value })} placeholder="Destination URL" className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm outline-none focus:border-blue-500" />
                <button className="rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-500 sm:col-span-2">Add advertisement</button>
              </form>
              <div className="mt-4 grid gap-2">{ads.map((ad) => <div key={ad.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 p-3 text-sm"><span className="truncate">{ad.title} <span className="text-slate-500">· {ad.position}</span></span><button onClick={() => void removeAd(ad.id)} aria-label={`Delete ${ad.title}`} className="text-slate-500 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}</div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#101a2b] p-6">
              <h2 className="mb-5 text-xl font-bold">Reader comments</h2>
              <div className="grid max-h-80 gap-2 overflow-y-auto">{comments.map((comment) => <div key={comment.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 p-3 text-sm"><p className="min-w-0 whitespace-pre-wrap text-slate-300">{comment.content}</p><button onClick={() => void removeComment(comment.id)} aria-label="Delete comment" className="text-slate-500 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}{!comments.length && <p className="text-sm text-slate-500">No reader comments yet.</p>}</div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
